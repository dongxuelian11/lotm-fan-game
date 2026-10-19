/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ARBITER_ABILITIES, ARBITER_CONSUMPTION_RISK } from "../../src/domain/arbiter/content";
import type { ArbiterAction, ArbiterCommand, ArbiterProjection } from "../../src/domain/arbiter/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ArbiterPanel } from "../../src/renderer/ArbiterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: ArbiterCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): ArbiterAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访民间调解文书员薇娜·贝尔");
function arbiter(patch: Partial<ArbiterProjection> = {}): ArbiterProjection {
  return {
    title: "仲裁人之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可了解渠道与服药。", pollution: 3,
    risk: ARBITER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): ArbiterProjection {
  return arbiter({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动抵扣600便士后付60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；跨周补给另行申请、领取。",
    actions: ["arbiter-potion-1", "arbiter-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "arbiter-potion-1", title: "第一瓶仲裁人魔药", source: "薇娜·贝尔独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "arbiter-potion-1", confirmed: true } },
      { id: "arbiter-potion-2", title: "第二瓶仲裁人魔药", source: "薇娜·贝尔独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "arbiter-potion-2", confirmed: true } },
      { id: "arbiter-potion-3", title: "第三瓶仲裁人魔药", source: "薇娜·贝尔独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "arbiter-potion-3", confirmed: true } },
    ],
  });
}
function cases(): ArbiterProjection["cases"] {
  return [
    { id: "shared-yard", title: "共用院落", story: "双方对原院落的使用时间有分歧，轮流安排仍须双方实际同意。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始交涉", closes: 0 },
    { id: "noisy-work", title: "嘈杂作业", story: "原作业声音影响交谈，当事人是否愿意降低声音仍须实际确认。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始交涉", closes: 0 },
    { id: "exit-dispute", title: "出口争执", story: "原出口被争执阻挡，当事人可以拒绝提议或自行离开。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始交涉", closes: 0 },
  ];
}
function opened(): ArbiterProjection {
  return arbiter({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "noisy-work" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次谈话尚未实际结束，仍须沿普通退路离开",
      observations: ["曾听到当事人明确拒绝当前安排，尚未形成新的约定。"],
      result: "本次威严未获接受；对方明确拒绝，仍须实际结束谈话并退出。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "noisy-work" }, "实际结束谈话并沿普通退路离开", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: ArbiterProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<ArbiterPanel arbiter={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("arbiter-renderer-run", sliceDefaultCreationSelection, "arbiter-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    arbiter: arbiter({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "仲裁人 · 序列9" : "仲裁人之路",
      actions: promoted ? [] : [discover], abilities: promoted ? ARBITER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "justiciar" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openArbiter() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^仲裁人(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Arbiter sequence-nine finite mediation dossier", () => {
  it("offers the twenty-first ordinary route and remembers the explicit selection", async () => {
    const api = bridge(fixture()); await enter(api); await openArbiter();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "仲裁人之路" }).getAttribute("aria-pressed")).toBe("true");
    expect(choices.getByRole("button", { name: "占卜家之路" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "仲裁人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "仲裁人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  }, 10_000);

  it("opens current growth with exactly three S9 abilities and no appointment or higher-sequence controls", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("仲裁人 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看仲裁人成长" }));
    const abilities = screen.getByRole("region", { name: "仲裁人能力与消化" });
    expect(ARBITER_ABILITIES.map(({ id }) => id)).toEqual([
      "justiciar.s9.authority", "justiciar.s9.persuasive-charisma", "justiciar.s9.combat-training",
    ]);
    expect(abilities.querySelectorAll("details")).toHaveLength(3);
    for (const ability of ARBITER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["当事人仍自主决定", "不保证服从", "不判定陈述真假", "不宣告有罪", "不提供序列6", "可能被抵抗", "不取消对方行动"]) expect(abilities.textContent).toContain(text);
    const summary = screen.getByRole("region", { name: "仲裁人成长下一步" });
    expect(summary.textContent).toContain("成年民间调解文书员薇娜·贝尔");
    expect(summary.textContent).toContain("没有获任政府职务");
    expect(summary.textContent).toContain("依据当前事实提出公平安排，并尊重当事人的自主选择是本阶段扮演解释，可完成本阶段消化");
    expect(screen.queryByRole("button", { name: /追踪|精神刺穿|神秘禁令|强制服从|宣告有罪/ })).toBeNull();
  });

  it("respects the W5 discovery gate and the independent finished-bottle supply terms", () => {
    const reason = "需要完成四个完整普通周，第5周起才可发现薇娜·贝尔的渠道。";
    const { onCommand, rerender } = panel(arbiter({ actions: [{ ...discover, enabled: false, reason }] }));
    const discoverButton = screen.getByRole("button", { name: /^拜访民间调解文书员/ });
    expect((discoverButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(discoverButton); expect(onCommand).not.toHaveBeenCalled();
    const value = bottled();
    rerender(<ArbiterPanel arbiter={{ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(new Set(value.bottles.map(({ id }) => id)).size).toBe(3);
    expect(screen.getByRole("region", { name: "仲裁人成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely at zero AP, restores focus, and consumes only the confirmed original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶仲裁人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("arbiter-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "仲裁人服用风险与四档结果" }).textContent).toContain(ARBITER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶仲裁人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "arbiter-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dispatches only public AUTHORITY or ORDINARY preparation without inventing facts", async () => {
    const choices = (["AUTHORITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "shared-yard", method }, `准备${method}`));
    const value = arbiter({ promoted: true, cases: cases(), actions: choices });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map(({ command }) => command));
    expect(screen.queryByRole("region", { name: "原争议、实际选择与有限报告" })).toBeNull();
    const boundary = screen.getByRole("region", { name: "威严、事实与自主选择边界" });
    expect(boundary.textContent).toContain("当事人可以拒绝、离开或提出异议");
    expect(boundary.textContent).toContain("不保证服从");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "exit-dispute");
    rerender(<ArbiterPanel arbiter={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("exit-dispute");
    expect(screen.getByRole("region", { name: "当前仲裁人实践" }).textContent).toContain("当事人可以拒绝提议或自行离开");
    expect(screen.queryByRole("button", { name: /^准备AUTHORITY/ })).toBeNull();
  });

  it("reports committed finite facts without a claim field or fabricated agreement", async () => {
    const report = action({ type: "REPORT", caseId: "shared-yard" }, "提交本次有限报告");
    const value = arbiter({ promoted: true, cases: cases().map((entry) => entry.id === "shared-yard" ? {
      ...entry, status: "EXAMINED", closes: 1, result: "原争议：双方希望使用同一处院落。实际选择：对方拒绝当前安排，未形成新约定。",
    } : entry), actions: [report] });
    const { onCommand } = panel(value);
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "原争议、实际选择与有限报告" }).textContent).toContain("对方拒绝当前安排，未形成新约定");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /确定真相|强制服从|宣告有罪|过度断言/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^提交本次有限报告/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "shared-yard" });
  });

  it("exposes only the actual matching CLOSE at zero resources and never manufactures one", async () => {
    const value = opened();
    const { onCommand, rerender } = panel({ ...value, actions: [...value.actions,
      action({ type: "REPORT", caseId: "noisy-work" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "noisy-work" }, "不能撤回代替结束"),
    ] }, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("noisy-work"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束谈话并沿普通退路离开/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "noisy-work" });
    expect(screen.getByRole("region", { name: "仲裁人成长下一步" }).textContent).toContain("不另抽随机、不奖励、不治疗、不退还此前成本");
    rerender(<ArbiterPanel arbiter={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "仲裁人成长下一步" }).textContent).toContain("查看当前公开结束选项");
  });

  it("keeps historical contact prose read-only without locking ordinary life on another route", async () => {
    const api = bridge(fixture(false, { arbiter: { ...bottled(), cases: opened().cases },
      progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 },
    }));
    await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "仲裁人经历" }));
    const history = within(screen.getByRole("region", { name: "仲裁人渠道经历" }));
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.getByText(/本次调解接触：本次谈话尚未实际结束/)).toBeTruthy();
    expect(history.getByText("来源：薇娜·贝尔独立留存的第一原瓶")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retries the exact failed preparation envelope and keeps the dossier after success", async () => {
    const command: ArbiterCommand = { type: "PREPARE", caseId: "shared-yard", method: "AUTHORITY" };
    const state = fixture(true, { arbiter: arbiter({ promoted: true, cases: cases(), actions: [action(command, "准备这次威严调解")] }) });
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1,
        arbiter: { ...state.arbiter, actions: [], cases: state.arbiter.cases.map((entry) => entry.id === "shared-yard" ? { ...entry, preparation: "实际准备已经保存" } : entry) },
      }, envelope));
    api.submitIntent = submit; await enter(api); await openArbiter();
    const button = screen.getByRole("button", { name: /^准备这次威严调解/ });
    fireEvent.click(button); fireEvent.click(button); expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("实际准备已经保存")).toBeNull();
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "仲裁人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("仲裁人模拟保存失败");
    expect((screen.getByRole("button", { name: /^准备这次威严调解/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "ARBITER", command });
    expect(screen.getByText("实际准备已经保存")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("restores an open contact at zero resources and unlocks only after the actual CLOSE receipt", async () => {
    const state = fixture(true, { arbiter: opened(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, arbiter: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "noisy-work" ? { ...entry, contactOpen: "本次谈话已结束，已经由普通退路离开", closes: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "实际退出尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "仲裁人成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次谈话并退出");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" });
    expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束谈话并沿普通退路离开/ }));
    expect(screen.getByRole("alert").textContent).toContain("实际退出尚未保存");
    expect(screen.getByText("本次调解接触：本次谈话尚未实际结束，仍须沿普通退路离开")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "ARBITER", command: { type: "CLOSE", caseId: "noisy-work" } });
    expect(screen.getByText("本次调解接触：本次谈话已结束，已经由普通退路离开")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it.each(["pryer", "briber"] as const)("preserves the older %s exit ahead of simultaneous Arbiter contact", async (older) => {
    const state = fixture(true, { arbiter: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: older === "pryer" ? "hermit" : "black-emperor", sequence: older === "pryer" ? 9 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (older === "pryer") state.pryer = { ...state.pryer, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "intrusive-page", title: "原异常页", story: "尚未合页。", status: "EXAMINED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else state.briber = { ...state.briber, promoted: true, insideCase: true,
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "volunteered-test" } }],
      cases: [{ id: "volunteered-test", title: "原赠物接触", story: "本次接触尚未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "仍在交涉", closes: 0 }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "仲裁人成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(older === "pryer" ? "PRYER" : "BRIBER");
  });
});
