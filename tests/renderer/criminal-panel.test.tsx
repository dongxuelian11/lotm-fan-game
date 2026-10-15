/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CRIMINAL_ABILITIES, CRIMINAL_CONSUMPTION_RISK } from "../../src/domain/criminal/content";
import type { CriminalAction, CriminalCommand, CriminalProjection } from "../../src/domain/criminal/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { CriminalHistory, CriminalPanel } from "../../src/renderer/CriminalPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: CriminalCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): CriminalAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访旧货管理员罗安·费里");
function criminal(patch: Partial<CriminalProjection> = {}): CriminalProjection {
  return {
    title: "罪犯之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: CRIMINAL_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): CriminalProjection {
  return criminal({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动后60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["criminal-potion-1", "criminal-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "criminal-potion-1", title: "第一瓶罪犯魔药", source: "罗安·费里独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "criminal-potion-1", confirmed: true } },
      { id: "criminal-potion-2", title: "第二瓶罪犯魔药", source: "罗安·费里独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "criminal-potion-2", confirmed: true } },
      { id: "criminal-potion-3", title: "第三瓶罪犯魔药", source: "罗安·费里独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "criminal-potion-3", confirmed: true } },
    ],
  });
}
function cases(): CriminalProjection["cases"] {
  return [
    { id: "found-pay", title: "地上的原工资袋", story: "缝有玛拉姓名的原工资袋落在地上，玛拉正在寻找它。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "原工资袋仍在现场", tookOriginal: false, returns: 0 },
    { id: "hasty-job", title: "催促接下的差事", story: "成年委托人催促接活，条件仍须普通核实。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "本次没有拿取原物", tookOriginal: false, returns: 0 },
    { id: "jammed-cart", title: "卡住的原货车", story: "车主守着卡住的货车，先看清原障碍和旁人位置。", observations: [], preparation: null, result: null, status: "AVAILABLE", holding: "本次没有拿取原物", tookOriginal: false, returns: 0 },
  ];
}
function holding(): CriminalProjection {
  return criminal({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "found-pay" ? {
      ...entry, status: "EXAMINED", holding: "玛拉的原工资袋在你手中，尚未交还原主人",
      tookOriginal: true, result: "你实际拿起了玛拉的原工资袋，未把其中的钱变为个人现金。",
    } : entry),
    actions: [action({ type: "RETURN", caseId: "found-pay" }, "把玛拉的原工资袋实际交回她手中", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: CriminalProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CriminalPanel criminal={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("criminal-renderer-run", sliceDefaultCreationSelection, "criminal-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    criminal: criminal({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "罪犯 · 序列9" : "罪犯之路",
      actions: promoted ? [] : [discover], abilities: promoted ? CRIMINAL_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "abyss" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openCriminal() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^罪犯(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Criminal sequence-nine public original-custody dossier", () => {
  it("offers seventeen ordinary routes and remembers the explicit Criminal selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openCriminal();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "罪犯之路" }).textContent).toContain("敏锐直觉");
    expect(screen.getByRole("region", { name: "罪犯成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "罪犯成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens the promoted route from its task link with bounded abilities and explicit G interpretation", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("罪犯 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看罪犯成长" }));
    const abilities = screen.getByRole("region", { name: "罪犯能力与消化" });
    for (const ability of CRIMINAL_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(abilities.textContent).toContain("仍保留良知");
    expect(abilities.textContent).toContain("不提供序列6");
    expect(screen.getByRole("region", { name: "罪犯成长下一步" }).textContent).toContain("本阶段的扮演方式，不保证无代价消化");
    expect(screen.queryByRole("button", { name: /危险预知|毒素免疫|火焰能力|序列8晋升/ })).toBeNull();
  });

  it("shows each original source and public supply terms without rendering unverified ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "罪犯成品渠道与配方边界" }).textContent).toContain("不提供完整配方");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms exactly the second original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶罪犯魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("criminal-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "罪犯服用风险与四档结果" }).textContent).toContain(CRIMINAL_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶罪犯魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "criminal-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<CriminalPanel criminal={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public bottle eligibility without deriving it from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<CriminalPanel criminal={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶罪犯魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the selected case and reveals no observations or result before a committed projection", async () => {
    const value = criminal({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "hasty-job");
    rerender(<CriminalPanel criminal={{ ...value, actions: [action({ type: "OBSERVE", caseId: "found-pay" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("hasty-job");
    expect(screen.getByRole("region", { name: "当前罪犯实践" }).textContent).toContain("条件仍须普通核实");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches only public ABILITY, ORDINARY and TAKE preparations without inventing possession", async () => {
    const choices = (["ABILITY", "ORDINARY", "TAKE"] as const).map((method) => action({ type: "PREPARE", caseId: "found-pay", method }, `准备${method}`));
    const { onCommand } = panel(criminal({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByText("原物去向：原工资袋仍在现场")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("button", { name: /归还/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "hasty-job");
    expect(screen.queryByRole("button", { name: /^准备TAKE/ })).toBeNull();
  });

  it("keeps REPORT eligibility and cost authoritative, including after an actual return", async () => {
    const report = action({ type: "REPORT", caseId: "found-pay" }, "记录本次实际结果", false, "1行动 · 原公开成本");
    report.reason = "已交还原物，下周须重新实际核对才可报告。";
    const value = criminal({ promoted: true, cases: holding().cases.map((entry) => entry.id === "found-pay" ? { ...entry, holding: "玛拉已实际接回原工资袋", returns: 1 } : entry), actions: [report] });
    const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^记录本次实际结果/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(button.textContent).toContain(report.cost);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText("曾拿取原物：是 · 实际归还次数：1")).toBeTruthy();
    rerender(<CriminalPanel criminal={{ ...value, actions: [{ ...report, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^记录本次实际结果/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "found-pay" });
  });

  it("selects the actual held original and allows only RETURN at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(criminal({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "jammed-cart");
    const value = holding();
    rerender(<CriminalPanel criminal={{ ...value, actions: [...value.actions, action({ type: "REPORT", caseId: "found-pay" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "found-pay" }, "不能撤回代替归还"), action({ type: "REFLECT" }, "不能提前反思")] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("found-pay"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("原物去向：玛拉的原工资袋在你手中，尚未交还原主人")).toBeTruthy();
    expect(screen.getByRole("region", { name: "罪犯成长下一步" }).textContent).toContain("不治疗伤势、不退还此前成本");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^把玛拉的原工资袋实际交回/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "found-pay" });
    expect(screen.getByText("原物去向：玛拉的原工资袋在你手中，尚未交还原主人")).toBeTruthy();
  });

  it("shows projection owner and custody text verbatim without inventing a hidden wage amount", () => {
    const value = holding(); value.cases[0] = { ...value.cases[0]!, holding: "新公开原主已接回同一工资袋，等待见证人核实", returns: 1 };
    panel({ ...value, insideCase: false, actions: [] });
    expect(screen.getByText("原物去向：新公开原主已接回同一工资袋，等待见证人核实")).toBeTruthy();
    expect(screen.getByText("曾拿取原物：是 · 实际归还次数：1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /归还/ })).toBeNull();
    expect(screen.queryByText(/工资袋内有.*便士|获得.*便士/)).toBeNull();
  });

  it("keeps a discovered Criminal channel read-only after selecting another route", async () => {
    const api = bridge(fixture(false, { criminal: bottled(), progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "罪犯经历" }));
    const history = within(screen.getByRole("region", { name: "罪犯渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.getByText("来源：罗安·费里独立留存的第一原瓶")).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves original custody and taking history without callback controls", () => {
    render(<CriminalHistory criminal={{ ...bottled(), cases: holding().cases }} />);
    expect(screen.getByText(/原物去向：玛拉的原工资袋在你手中/)).toBeTruthy();
    expect(screen.getByText(/曾拿取原物：是 · 实际归还次数：0/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "RETURN", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts or duplicate clicks", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: CriminalCommand = type === "CONSUME" ? { type, bottleId: "criminal-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "found-pay", method: "TAKE" }
      : { type, caseId: "found-pay" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "RETURN"].includes(type);
    const state = fixture(isLife, { criminal: type === "CONSUME" ? bottled() : criminal({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, criminal: { ...state.criminal, actions: [], bottles: state.criminal.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openCriminal();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶罪犯魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "罪犯模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("罪犯模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CRIMINAL", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads held custody at zero resources and unlocks only after the actual RETURN receipt", async () => {
    const state = fixture(true, { criminal: holding(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, criminal: { ...holding(), insideCase: false,
      actions: [], cases: holding().cases.map((entry) => entry.id === "found-pay" ? { ...entry, holding: "玛拉已实际接回原工资袋", returns: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "交还尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "罪犯成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先把手中的原物实际交还");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^把玛拉的原工资袋实际交回/ }));
    expect(screen.getByRole("alert").textContent).toContain("交还尚未保存");
    expect(screen.getByText("原物去向：玛拉的原工资袋在你手中，尚未交还原主人")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "CRIMINAL", command: { type: "RETURN", caseId: "found-pay" } });
    expect(screen.getByText("原物去向：玛拉已实际接回原工资袋")).toBeTruthy();
    expect(screen.getByText("曾拿取原物：是 · 实际归还次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
    expect(next.cash).toBe(state.cash); expect(next.health).toBe(state.health); expect(next.mind).toBe(state.mind);
  });

  it.each(["COVER", "LEAVE", "REVEAL"] as const)("keeps the older %s physical exit ahead of simultaneous held custody", async (exit) => {
    const state = fixture(true, { criminal: holding(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: "hanged-man", sequence: exit === "COVER" ? 9 : exit === "LEAVE" ? 8 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (exit === "COVER") state.secretSupplicant = { ...state.secretSupplicant, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "covered-token", title: "原罩", story: "原罩仍打开。", status: "EXAMINED", contactOpen: "尚未盖回", overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-cover", label, cost: "0行动", enabled: true, reason: null, command: { type: "COVER", caseId: "covered-token" } }],
    };
    else if (exit === "LEAVE") state.listener = { ...state.listener, promoted: true, insideCase: true,
      cases: [{ id: "still-corner", title: "旧倾听位置", story: "本人仍未离开。", status: "EXAMINED", contactOpen: "尚未离开", verified: false, overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-leave", label, cost: "0行动", enabled: true, reason: null, command: { type: "LEAVE", caseId: "still-corner" } }],
    };
    else state.shadowAscetic = { ...state.shadowAscetic, promoted: true, insideCase: true,
      cases: [{ id: "lit-alcove", title: "旧阴影现场", story: "本人仍藏于现场。", status: "EXAMINED", shadowOpen: "尚未实际退出", hidden: true, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-reveal", label, cost: "0行动", enabled: true, reason: null, command: { type: "REVEAL", caseId: "lit-alcove" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "罪犯成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(exit === "COVER" ? "SECRET_SUPPLICANT" : exit === "LEAVE" ? "LISTENER" : "SHADOW_ASCETIC");
  });

  it("does not lock ordinary life for preparation, EXAMINED status or historical taking without actual custody", async () => {
    const value = criminal({ promoted: true, cases: holding().cases, insideCase: false, actions: [] });
    const api = bridge(fixture(true, { criminal: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openCriminal(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^把玛拉的原工资袋实际交回/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a failed consumed original gone and opens a different bottle with updated resources", async () => {
    const state = fixture(false, { criminal: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      criminal: { ...state.criminal, bottles: state.criminal.bottles.map((bottle) => bottle.id === "criminal-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.criminal.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openCriminal();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶罪犯魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("criminal-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
