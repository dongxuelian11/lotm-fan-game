/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { PRISONER_ABILITIES, PRISONER_CONSUMPTION_RISK } from "../../src/domain/prisoner/content";
import type { PrisonerAction, PrisonerCommand, PrisonerProjection } from "../../src/domain/prisoner/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { PrisonerPanel } from "../../src/renderer/PrisonerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: PrisonerCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): PrisonerAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访旧工坊管理员哈伦·维斯");
function prisoner(patch: Partial<PrisonerProjection> = {}): PrisonerProjection {
  return {
    title: "囚犯之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: PRISONER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): PrisonerProjection {
  return prisoner({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动后60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["prisoner-potion-1", "prisoner-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "prisoner-potion-1", title: "第一瓶囚犯魔药", source: "哈伦·维斯独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "prisoner-potion-1", confirmed: true } },
      { id: "prisoner-potion-2", title: "第二瓶囚犯魔药", source: "哈伦·维斯独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "prisoner-potion-2", confirmed: true } },
      { id: "prisoner-potion-3", title: "第三瓶囚犯魔药", source: "哈伦·维斯独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "prisoner-potion-3", confirmed: true } },
    ],
  });
}
function cases(): PrisonerProjection["cases"] {
  return [
    { id: "jammed-shutter", title: "卡住的原百叶窗", story: "原百叶窗被卡住，哈伦·维斯的木垫块仍在原桌。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "原木垫块仍在原桌", returns: 0 },
    { id: "echo-room", title: "回声中的原房间", story: "原房间传来回声，气流与声源条件仍须普通核实。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "本次没有拿取原物", returns: 0 },
    { id: "shared-exit", title: "共用的原出口", story: "成人同伴也要通过原出口，先看清原障碍和旁人位置。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "本次没有拿取原物", returns: 0 },
  ];
}
function holding(): PrisonerProjection {
  return prisoner({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "jammed-shutter" ? {
      ...entry, status: "EXAMINED", holding: "哈伦·维斯的原木垫块在你手中，尚未放回原桌",
      result: "你实际借用了哈伦·维斯的原木垫块；本次百叶窗尝试失败，原物仍须另行放回。",
    } : entry),
    actions: [action({ type: "RETURN", caseId: "jammed-shutter" }, "把哈伦·维斯的原木垫块实际放回原桌", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: PrisonerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PrisonerPanel prisoner={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("prisoner-renderer-run", sliceDefaultCreationSelection, "prisoner-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    prisoner: prisoner({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "囚犯 · 序列9" : "囚犯之路",
      actions: promoted ? [] : [discover], abilities: promoted ? PRISONER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "chained" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openPrisoner() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^囚犯(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Prisoner sequence-nine public original-custody dossier", () => {
  it("offers eighteen ordinary routes and remembers the explicit Prisoner selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openPrisoner();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "囚犯之路" }).textContent).toContain("敏锐感知");
    expect(choices.getByRole("button", { name: "囚犯之路" }).getAttribute("aria-pressed")).toBe("true");
    expect(choices.getByRole("button", { name: "占卜家之路" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "囚犯成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "囚犯成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens the promoted route from its task link with bounded abilities and stage-scoped interpretation", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("囚犯 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看囚犯成长" }));
    const abilities = screen.getByRole("region", { name: "囚犯能力与消化" });
    for (const ability of PRISONER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(abilities.textContent).toContain("普通物件");
    expect(abilities.textContent).toContain("不提供序列8");
    expect(screen.getByRole("region", { name: "囚犯成长下一步" }).textContent).toContain("不消除更高序列的未来诅咒");
    expect(screen.getByRole("region", { name: "囚犯成长下一步" }).textContent).toContain("本阶段扮演解释");
    expect(screen.getByRole("region", { name: "囚犯成长下一步" }).textContent).toContain("也不保证安全消化");
    for (const marker of ["G扮演", "原著"]) expect(screen.getByRole("region", { name: "囚犯成长下一步" }).textContent).not.toContain(marker);
    expect(screen.queryByRole("button", { name: /疯狂强化|狼人变化|自愈|序列8晋升/ })).toBeNull();
  });

  it("shows each original source and public supply terms without rendering unverified ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "囚犯成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms exactly the second original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶囚犯魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("prisoner-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "囚犯服用风险与四档结果" }).textContent).toContain(PRISONER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶囚犯魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "prisoner-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<PrisonerPanel prisoner={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public bottle eligibility without deriving it from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<PrisonerPanel prisoner={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶囚犯魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the selected case and reveals no observations or result before a committed projection", async () => {
    const value = prisoner({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "echo-room");
    rerender(<PrisonerPanel prisoner={{ ...value, actions: [action({ type: "OBSERVE", caseId: "jammed-shutter" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("echo-room");
    expect(screen.getByRole("region", { name: "当前囚犯实践" }).textContent).toContain("条件仍须普通核实");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches public ABILITY and ORDINARY preparations without inventing a borrowed object", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "jammed-shutter", method }, `准备${method}`));
    const { onCommand } = panel(prisoner({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByText("原物去向：原木垫块仍在原桌")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("button", { name: /归还/ })).toBeNull();
    expect(screen.getByRole("region", { name: "实践范围与节制边界" }).textContent).toContain("成功或失败后都须另行放回原桌");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "echo-room");
    expect(screen.queryByRole("button", { name: /^准备ABILITY/ })).toBeNull();
  });

  it("keeps REPORT eligibility and cost authoritative, including after an actual return", async () => {
    const report = action({ type: "REPORT", caseId: "jammed-shutter" }, "记录本次实际结果", false, "1行动 · 原公开成本");
    report.reason = "已交还原物，下周须重新实际核对才可报告。";
    const value = prisoner({ promoted: true, cases: holding().cases.map((entry) => entry.id === "jammed-shutter" ? { ...entry, holding: "哈伦·维斯的原木垫块已实际放回原桌", returns: 1 } : entry), actions: [report] });
    const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^记录本次实际结果/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(button.textContent).toContain(report.cost);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText("实际归还次数：1")).toBeTruthy();
    rerender(<PrisonerPanel prisoner={{ ...value, actions: [{ ...report, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^记录本次实际结果/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "jammed-shutter" });
  });

  it("selects the actual held original and allows only RETURN at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(prisoner({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "shared-exit");
    const value = holding();
    rerender(<PrisonerPanel prisoner={{ ...value, actions: [...value.actions, action({ type: "REPORT", caseId: "jammed-shutter" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "jammed-shutter" }, "不能撤回代替归还"), action({ type: "REFLECT" }, "不能提前反思")] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("jammed-shutter"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("原物去向：哈伦·维斯的原木垫块在你手中，尚未放回原桌")).toBeTruthy();
    expect(screen.getByRole("region", { name: "囚犯成长下一步" }).textContent).toContain("不另抽随机、不奖励、不治疗、不退还此前成本");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^把哈伦·维斯的原木垫块实际放回/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "jammed-shutter" });
    expect(screen.getByText("原物去向：哈伦·维斯的原木垫块在你手中，尚未放回原桌")).toBeTruthy();
  });

  it("keeps a discovered Prisoner channel read-only after selecting another route", async () => {
    const api = bridge(fixture(false, { prisoner: { ...bottled(), cases: holding().cases }, progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "囚犯经历" }));
    const history = within(screen.getByRole("region", { name: "囚犯渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.queryByRole("combobox")).toBeNull();
    expect(history.getByText(/原物去向：哈伦·维斯的原木垫块在你手中/)).toBeTruthy();
    expect(history.getByText("来源：哈伦·维斯独立留存的第一原瓶")).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "PREPARE", "PERFORM", "RETURN", "REPORT", "WITHDRAW", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts or duplicate clicks", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: PrisonerCommand = type === "CONSUME" ? { type, bottleId: "prisoner-potion-2", confirmed: true }
      : type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "jammed-shutter", method: "ABILITY" }
      : { type, caseId: "jammed-shutter" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "RETURN"].includes(type);
    const state = fixture(isLife, { prisoner: type === "CONSUME" ? bottled() : prisoner({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, prisoner: { ...state.prisoner, actions: [], bottles: state.prisoner.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openPrisoner();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶囚犯魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "囚犯模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("囚犯模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "PRISONER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads held custody at zero resources and unlocks only after the actual RETURN receipt", async () => {
    const state = fixture(true, { prisoner: holding(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, prisoner: { ...holding(), insideCase: false,
      actions: [], cases: holding().cases.map((entry) => entry.id === "jammed-shutter" ? { ...entry, holding: "哈伦·维斯的原木垫块已实际放回原桌", returns: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "交还尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "囚犯成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先把借用的原木垫块放回原桌");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) {
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^把哈伦·维斯的原木垫块实际放回/ }));
    expect(screen.getByRole("alert").textContent).toContain("交还尚未保存");
    expect(screen.getByText("原物去向：哈伦·维斯的原木垫块在你手中，尚未放回原桌")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "PRISONER", command: { type: "RETURN", caseId: "jammed-shutter" } });
    expect(screen.getByText("原物去向：哈伦·维斯的原木垫块已实际放回原桌")).toBeTruthy();
    expect(screen.getByText("实际归还次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
    expect(next.cash).toBe(state.cash); expect(next.health).toBe(state.health); expect(next.mind).toBe(state.mind);
  });

  it.each(["RETURN", "STAND_DOWN", "CLOSE"] as const)("keeps the older %s physical exit ahead of simultaneous borrowed custody", async (exit) => {
    const state = fixture(true, { prisoner: holding(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: "abyss", sequence: exit === "RETURN" ? 9 : exit === "STAND_DOWN" ? 8 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (exit === "RETURN") state.criminal = { ...state.criminal, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "found-pay", title: "原工资袋", story: "原工资袋仍须交还。", status: "EXAMINED", holding: "原工资袋仍在手中", tookOriginal: true, returns: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-return", label, cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "found-pay" } }],
    };
    else if (exit === "STAND_DOWN") state.unwinged = { ...state.unwinged, promoted: true, insideCase: true,
      cases: [{ id: "cold-grip", title: "旧接触", story: "本人仍未松手。", status: "EXAMINED", urgeOpen: "尚未松手", restraints: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-stand-down", label, cost: "0行动", enabled: true, reason: null, command: { type: "STAND_DOWN", caseId: "cold-grip" } }],
    };
    else state.serialKiller = { ...state.serialKiller, promoted: true, insideCase: true,
      cases: [{ id: "sealed-index", title: "旧知识接触", story: "本次接触尚未收束。", status: "EXAMINED", contactOpen: "尚未收束", closures: 0, overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "sealed-index" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "囚犯成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(exit === "RETURN" ? "CRIMINAL" : exit === "STAND_DOWN" ? "UNWINGED" : "SERIAL_KILLER");
  });

  it.each(["PREPARED", "EXAMINED", "RESOLVED"] as const)("does not lock ordinary life for %s records without actual custody", async (status) => {
    const value = prisoner({ promoted: true, cases: cases().map((entry) => ({ ...entry, status, preparation: "旧准备仍可回看", result: "已提交的原结果", returns: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(true, { prisoner: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openPrisoner(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^把哈伦·维斯的原木垫块实际放回/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a failed consumed original gone and opens a different bottle with updated resources", async () => {
    const state = fixture(false, { prisoner: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      prisoner: { ...state.prisoner, bottles: state.prisoner.bottles.map((bottle) => bottle.id === "prisoner-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.prisoner.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openPrisoner();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶囚犯魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("prisoner-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
