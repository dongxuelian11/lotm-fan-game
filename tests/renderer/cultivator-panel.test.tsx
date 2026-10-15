/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CULTIVATOR_ABILITIES, CULTIVATOR_CONSUMPTION_RISK } from "../../src/domain/cultivator/content";
import type { CultivatorAction, CultivatorCommand, CultivatorProjection } from "../../src/domain/cultivator/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { CultivatorPanel } from "../../src/renderer/CultivatorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: CultivatorCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): CultivatorAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访苗圃照料员伊芙·莫兰");
function cultivator(patch: Partial<CultivatorProjection> = {}): CultivatorProjection {
  return {
    title: "耕种者之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可了解渠道与服药。", pollution: 3,
    risk: CULTIVATOR_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", garden: "", ...patch,
  };
}
function bottled(): CultivatorProjection {
  return cultivator({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动抵扣600便士后付60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；跨周补给另行申请、领取。",
    actions: ["cultivator-potion-1", "cultivator-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "cultivator-potion-1", title: "第一瓶耕种者魔药", source: "伊芙·莫兰独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "cultivator-potion-1", confirmed: true } },
      { id: "cultivator-potion-2", title: "第二瓶耕种者魔药", source: "伊芙·莫兰独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "cultivator-potion-2", confirmed: true } },
      { id: "cultivator-potion-3", title: "第三瓶耕种者魔药", source: "伊芙·莫兰独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "cultivator-potion-3", confirmed: true } },
    ],
  });
}
function cases(): CultivatorProjection["cases"] {
  return [
    { id: "soil-record", title: "原土记录", story: "观察原土与原记录，尚未观察的土壤情况仍须实际确认。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始照护", closes: 0 },
    { id: "seed-bed", title: "原苗床", story: "栽种、跨周照护与实际收获必须处理同一批原种子和作物。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始照护", closes: 0 },
    { id: "shared-basket", title: "共享菜篮", story: "分享已经实际收获的原份额，不凭空增加收成。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未开始照护", closes: 0 },
  ];
}
function opened(): CultivatorProjection {
  return cultivator({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "seed-bed" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次照护尚未实际结束，仍须收好工具后退出",
      observations: ["曾记录本批种子的实际投入，作物尚未成熟。"],
      result: "本次原种子已入土；仍须实际收好工具并退出，不能立刻收获。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "seed-bed" }, "实际收好工具并退出照护现场", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: CultivatorProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<CultivatorPanel cultivator={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("cultivator-renderer-run", sliceDefaultCreationSelection, "cultivator-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    cultivator: cultivator({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "耕种者 · 序列9" : "耕种者之路",
      actions: promoted ? [] : [discover], abilities: promoted ? CULTIVATOR_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "mother" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openCultivator() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^耕种者(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Cultivator sequence-nine finite cultivation dossier", () => {
  it("offers the twenty-second ordinary route and remembers the explicit selection", async () => {
    const api = bridge(fixture()); await enter(api); await openCultivator();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "耕种者之路" }).getAttribute("aria-pressed")).toBe("true");
    expect(choices.getByRole("button", { name: "占卜家之路" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "耕种者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "耕种者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current growth with three bounded G abilities and no higher-sequence controls", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("耕种者 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看耕种者成长" }));
    const abilities = screen.getByRole("region", { name: "耕种者能力与消化" });
    expect(CULTIVATOR_ABILITIES.map(({ id }) => id)).toEqual([
      "mother.s9.cultivation-knowledge", "mother.s9.season-observation", "mother.s9.careful-practice",
    ]);
    expect(abilities.querySelectorAll("details")).toHaveLength(3);
    for (const ability of CULTIVATOR_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["三项有界能力", "不控制天气", "不即时催熟", "不凭空创造收成", "弗兰克的序列6杂交能力"]) expect(abilities.textContent).toContain(text);
    const summary = screen.getByRole("region", { name: "耕种者成长下一步" });
    expect(summary.textContent).toContain("成年苗圃照料员伊芙·莫兰");
    expect(summary.textContent).toContain("以当前说明为准");
    expect(summary.textContent).toContain("本阶段扮演解释");
    expect(screen.queryByRole("button", { name: /控制天气|即时催熟|杂交|生物改造/ })).toBeNull();
  });

  it("respects the W5 discovery gate and the independent finished-bottle supply terms", () => {
    const reason = "需要完成四个完整普通周，第5周起才可发现伊芙·莫兰的渠道。";
    const { onCommand, rerender } = panel(cultivator({ actions: [{ ...discover, enabled: false, reason }] }));
    const discoverButton = screen.getByRole("button", { name: /^拜访苗圃照料员/ });
    expect((discoverButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(discoverButton); expect(onCommand).not.toHaveBeenCalled();
    const value = bottled();
    rerender(<CultivatorPanel cultivator={{ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(new Set(value.bottles.map(({ id }) => id)).size).toBe(3);
    expect(screen.getByRole("region", { name: "耕种者成品渠道与配方边界" }).textContent).toContain("不提供完整配方");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely at zero AP, restores focus, and consumes only the confirmed original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶耕种者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("cultivator-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "耕种者服用风险与四档结果" }).textContent).toContain(CULTIVATOR_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶耕种者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "cultivator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dispatches only public ABILITY or ORDINARY preparation without inventing growth", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "soil-record", method }, `准备${method}`));
    const value = cultivator({ promoted: true, cases: cases(), actions: choices });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map(({ command }) => command));
    expect(screen.queryByRole("region", { name: "原物、照护经过与有限报告" })).toBeNull();
    const boundary = screen.getByRole("region", { name: "原物、时间与照护边界" });
    expect(boundary.textContent).toContain("作物须经历真实周次与实际照护");
    expect(boundary.textContent).toContain("不制造种子、水或收成");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "shared-basket");
    rerender(<CultivatorPanel cultivator={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("shared-basket");
    expect(screen.getByRole("region", { name: "当前耕种者实践" }).textContent).toContain("分享已经实际收获的原份额");
    expect(screen.queryByRole("button", { name: /^准备ABILITY/ })).toBeNull();
  });

  it("reports committed finite facts without a claim field or fabricated harvest", async () => {
    const report = action({ type: "REPORT", caseId: "soil-record" }, "提交本次有限报告");
    const value = cultivator({ promoted: true, cases: cases().map((entry) => entry.id === "soil-record" ? {
      ...entry, status: "EXAMINED", closes: 1, result: "原物：同一批原种子。实际结果：已栽种，尚未经过成熟周次，不可收获。",
    } : entry), actions: [report] });
    const { onCommand } = panel(value);
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "原物、照护经过与有限报告" }).textContent).toContain("尚未经过成熟周次，不可收获");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /立即丰收|催熟|杂交|过度断言/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^提交本次有限报告/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "soil-record" });
  });

  it("exposes only the actual matching CLOSE at zero resources and never manufactures one", async () => {
    const value = opened();
    const { onCommand, rerender } = panel({ ...value, actions: [...value.actions,
      action({ type: "REPORT", caseId: "seed-bed" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "seed-bed" }, "不能撤回代替结束"),
    ] }, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("seed-bed"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际收好工具并退出照护现场/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "seed-bed" });
    expect(screen.getByRole("region", { name: "耕种者成长下一步" }).textContent).toContain("不另抽随机、不奖励、不治疗、不退还此前成本");
    rerender(<CultivatorPanel cultivator={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "耕种者成长下一步" }).textContent).toContain("查看当前公开结束选项");
  });

  it("keeps historical contact prose read-only without locking ordinary life on another route", async () => {
    const api = bridge(fixture(false, { cultivator: { ...bottled(), cases: opened().cases, garden: "原收成2份，已分享1份，留存1份。" },
      progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 },
    }));
    await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "耕种者经历" }));
    const history = within(screen.getByRole("region", { name: "耕种者渠道经历" }));
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.getByText(/本次照护接触：本次照护尚未实际结束/)).toBeTruthy();
    expect(history.getByText("来源：伊芙·莫兰独立留存的第一原瓶")).toBeTruthy();
    expect(history.getByText("原收成2份，已分享1份，留存1份。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retries the exact failed preparation envelope and keeps the dossier after success", async () => {
    const command: CultivatorCommand = { type: "PREPARE", caseId: "soil-record", method: "ABILITY" };
    const state = fixture(true, { cultivator: cultivator({ promoted: true, cases: cases(), actions: [action(command, "准备这次原土照护")] }) });
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1,
        cultivator: { ...state.cultivator, actions: [], cases: state.cultivator.cases.map((entry) => entry.id === "soil-record" ? { ...entry, preparation: "实际准备已经保存" } : entry) },
      }, envelope));
    api.submitIntent = submit; await enter(api); await openCultivator();
    const button = screen.getByRole("button", { name: /^准备这次原土照护/ });
    fireEvent.click(button); fireEvent.click(button); expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("实际准备已经保存")).toBeNull();
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "耕种者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("耕种者模拟保存失败");
    expect((screen.getByRole("button", { name: /^准备这次原土照护/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CULTIVATOR", command });
    expect(screen.getByText("实际准备已经保存")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("restores an open contact at zero resources and unlocks only after the actual CLOSE receipt", async () => {
    const state = fixture(true, { cultivator: opened(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, cultivator: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "seed-bed" ? { ...entry, contactOpen: "本次照护已结束，已收好工具并退出现场", closes: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "实际退出尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "耕种者成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际收好工具并退出照护现场");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" });
    expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际收好工具并退出照护现场/ }));
    expect(screen.getByRole("alert").textContent).toContain("实际退出尚未保存");
    expect(screen.getByText("本次照护接触：本次照护尚未实际结束，仍须收好工具后退出")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "CULTIVATOR", command: { type: "CLOSE", caseId: "seed-bed" } });
    expect(screen.getByText("本次照护接触：本次照护已结束，已收好工具并退出现场")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("shows only authoritative seed, water, week and original-harvest facts and type-only garden actions", async () => {
    const buy = action({ type: "BUY_GARDEN" }, "取得这一份种植包", true, "1行动 · 60便士 · 原种子3份与水2份 · 仅一包");
    const care = { ...action({ type: "CARE" }, "实际照护原苗床", false, "1行动 · 原水1份"), reason: "须在栽种后的下一周实际照护。" };
    const harvest = { ...action({ type: "HARVEST" }, "实际收取原收成", false, "1行动 · 取得原收成2份"), reason: "须实际照护，并距栽种至少两周。" };
    const value = cultivator({ promoted: true, actions: [buy, care, harvest],
      garden: "只有一包：60便士，原种子3份、水2份。尚未栽种，尚未收成。",
    });
    const { onCommand, rerender } = panel(value);
    const garden = () => screen.getByRole("region", { name: "原苗床与实际收成" });
    expect(garden().textContent).toContain(value.garden);
    expect(screen.getByText(buy.cost)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^实际照护原苗床/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^实际收取原收成/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^实际照护原苗床/ }));
    fireEvent.click(screen.getByRole("button", { name: /^实际收取原收成/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^取得这一份种植包/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "BUY_GARDEN" });
    expect(garden().textContent).toContain("尚未栽种，尚未收成");
    const planted = { ...value, garden: "W7实际栽种原种子3份并使用原水1份；余水1份。W8起可照护，W9起才可收获。", actions: [{ ...care, enabled: true, reason: null }, harvest] };
    rerender(<CultivatorPanel cultivator={planted} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际照护原苗床/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CARE" });
    expect(garden().textContent).toContain("余水1份");
    rerender(<CultivatorPanel cultivator={{ ...planted, garden: "W8已实际照护，原水已用尽；仍未收获。", actions: [{ ...harvest, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际收取原收成/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "HARVEST" });
    expect(garden().textContent).toContain("仍未收获");
    rerender(<CultivatorPanel cultivator={{ ...planted, garden: "W9已实际收获原份额2份；已分享原份额1份，留存1份。", actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(garden().textContent).toContain("已分享原份额1份，留存1份");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "BUY_GARDEN" }, { type: "CARE" }, { type: "HARVEST" }]);
  });

  const receiptCommands: CultivatorCommand[] = [
    { type: "DISCOVER" }, { type: "LEARN_GUIDANCE" },
    { type: "POTION_WORK", bottleId: "cultivator-potion-1" },
    { type: "BUY_POTION", bottleId: "cultivator-potion-1" },
    { type: "CONSUME", bottleId: "cultivator-potion-1", confirmed: true },
    { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    { type: "OBSERVE", caseId: "soil-record" },
    { type: "PREPARE", caseId: "soil-record", method: "ABILITY" },
    { type: "PREPARE", caseId: "soil-record", method: "ORDINARY" },
    { type: "PERFORM", caseId: "soil-record" }, { type: "CLOSE", caseId: "soil-record" },
    { type: "REPORT", caseId: "soil-record" }, { type: "WITHDRAW", caseId: "soil-record" },
    { type: "REFLECT" }, { type: "BUY_GARDEN" }, { type: "CARE" }, { type: "HARVEST" },
  ];
  it.each(receiptCommands)("keeps the Cultivator dossier after the committed $type receipt", async (command) => {
    const acquisition = ["DISCOVER", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(command.type);
    const value = cultivator({ ...bottled(), promoted: !acquisition, cases: cases(), insideCase: command.type === "CLOSE",
      actions: [action(command, `提交公开${command.type}`)],
    });
    const state = fixture(!acquisition, { cultivator: value });
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1,
        cultivator: { ...value, insideCase: false, actions: [], story: `已保存原${command.type}结果`,
          bottles: value.bottles.map((bottle) => command.type === "CONSUME" && bottle.id === command.bottleId ? { ...bottle, status: "原瓶已实际服用" } : bottle),
        },
      }, envelope));
    await enter(api);
    if (command.type !== "CLOSE") await openCultivator();
    if (command.type === "CONSUME") {
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
      await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶耕种者魔药」" }));
    } else await userEvent.click(screen.getByRole("button", { name: new RegExp(`^提交公开${command.type}`) }));
    expect(await screen.findByText(`已保存原${command.type}结果`)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "耕种者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "CULTIVATOR", command });
  });

  it.each(["pryer", "briber", "interrogator"] as const)("preserves the older %s exit ahead of simultaneous Cultivator contact", async (older) => {
    const state = fixture(true, { cultivator: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: older === "pryer" ? "hermit" : older === "briber" ? "black-emperor" : "justiciar", sequence: older === "pryer" ? 9 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (older === "pryer") state.pryer = { ...state.pryer, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "intrusive-page", title: "原异常页", story: "尚未合页。", status: "EXAMINED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else if (older === "briber") state.briber = { ...state.briber, promoted: true, insideCase: true,
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "volunteered-test" } }],
      cases: [{ id: "volunteered-test", title: "原赠物接触", story: "本次接触尚未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "仍在交涉", closes: 0 }],
    };
    else state.interrogator = { ...state.interrogator, promoted: true, insideCase: true,
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "conflicting-delivery" } }],
      cases: [{ id: "conflicting-delivery", title: "原谈话", story: "本次谈话尚未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "仍在谈话", closes: 0 }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "耕种者成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(older === "pryer" ? "PRYER" : older === "briber" ? "BRIBER" : "INTERROGATOR");
  });
});
