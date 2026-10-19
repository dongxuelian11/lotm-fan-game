/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ASSASSIN_ABILITIES, ASSASSIN_CONSUMPTION_RISK } from "../../src/domain/assassin/content";
import type { AssassinAction, AssassinCommand, AssassinProjection } from "../../src/domain/assassin/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { AssassinHistory, AssassinPanel } from "../../src/renderer/AssassinPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: AssassinCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): AssassinAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访独立训练场导师诺艾拉·温瑟");
function assassin(patch: Partial<AssassinProjection> = {}): AssassinProjection {
  return {
    title: "刺客之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: ASSASSIN_CONSUMPTION_RISK, cases: [], draft: null, insideCase: false, environment: "", ...patch,
  };
}
function bottled(): AssassinProjection {
  return assassin({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；两次实际劳动后60便士，指导120便士。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["assassin-potion-1", "assassin-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "assassin-potion-1", title: "第一瓶刺客魔药", source: "诺艾拉·温瑟独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "assassin-potion-1", confirmed: true } },
      { id: "assassin-potion-2", title: "第二瓶刺客魔药", source: "诺艾拉·温瑟独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "assassin-potion-2", confirmed: true } },
      { id: "assassin-potion-3", title: "第三瓶刺客魔药", source: "诺艾拉·温瑟独立留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "assassin-potion-3", confirmed: true } },
    ],
  });
}
function cases(): AssassinProjection["cases"] {
  return [
    { id: "dim-sign", title: "暗处的原标记", story: "昏暗处有实际标记，必须核对原物。", observations: [], preparation: null, result: null, status: "AVAILABLE", position: "原起点" },
    { id: "upper-draft", title: "上层平台的练习原稿", story: "原稿属于导师，拿取不转让所有权。", observations: [], preparation: null, result: null, status: "AVAILABLE", position: "原起点" },
    { id: "shadow-cross", title: "有灯光的阴影通道", story: "亮处与声响都可能暴露实际位置。", observations: [], preparation: null, result: null, status: "AVAILABLE", position: "原起点" },
    { id: "padded-burst", title: "有停止信号的软垫练习", story: "导师同意受控练习，集中一击仍须收力。", observations: [], preparation: null, result: null, status: "AVAILABLE", position: "原起点" },
  ];
}
const draft: NonNullable<AssassinProjection["draft"]> = {
  id: "assassin-original-draft", owner: "诺艾拉·温瑟", custodian: "你实际持有",
  location: "上层平台，本人手中的原稿", version: 2,
};
function upstairs(): AssassinProjection {
  const lightness = action({ type: "RETURN", caseId: "upper-draft", route: "LIGHTNESS" }, "以轻盈身法返回原起点", false, "0行动 · 2灵性 · 实际返回检定");
  lightness.reason = "灵性不足2点；仍可沿已打开的普通楼梯返回。";
  return assassin({ promoted: true, discovered: true, insideCase: true, draft,
    cases: cases().map((entry) => entry.id === "upper-draft" ? { ...entry, status: "EXAMINED", position: "上层平台", result: "你已取得原稿，仍在上层平台。" } : entry),
    actions: [lightness, action({ type: "RETURN", caseId: "upper-draft", route: "STAIRS" }, "沿已打开的普通楼梯返回原起点", true, "0行动 · 0灵性 · 导师必要时扶行")],
  });
}
function panel(value: AssassinProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AssassinPanel assassin={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("assassin-renderer-run", sliceDefaultCreationSelection, "assassin-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    assassin: assassin({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "刺客 · 序列9" : "刺客之路",
      actions: promoted ? [] : [discover], abilities: promoted ? ASSASSIN_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "demoness" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openAssassin() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^刺客(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Assassin sequence-nine finite-work dossier", () => {
  it("shows the fourteenth route only in the explicit selector and remembers the ordinary choice", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("button", { name: "刺客之路" })).toBeNull();
    await openAssassin();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "刺客之路" }).textContent).toContain("借影藏身");
    expect(screen.getByRole("region", { name: "刺客成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /教唆者|女巫|黑焰|冰霜|镜替/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "刺客成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("automatically selects the promoted route and exposes only four bounded S9 abilities", async () => {
    await enter(bridge(fixture(true)));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const abilities = screen.getByRole("region", { name: "刺客能力与消化" });
    expect(abilities.textContent).toContain("4 项训练记录");
    for (const ability of ASSASSIN_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
  });

  it("shows distinct original sources and public supply terms without inventing a recipe", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "刺客成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    for (const bottle of value.bottles) {
      expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
      expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    }
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms the exact second bottle once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶刺客魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("assassin-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：诺艾拉·温瑟独立留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "刺客服用风险与四档结果" }).textContent).toContain(ASSASSIN_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶刺客魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "assassin-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<AssassinPanel assassin={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility and costs without locally calculating readiness", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "原瓶仍在，但需要先恢复身心。";
    rerender(<AssassinPanel assassin={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶刺客魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getAllByText("0行动 · 独立确认 · 消耗这瓶魔药")).toHaveLength(2);
  });

  it("displays the public ordinary-week gate and finite resupply terms without deriving eligibility", () => {
    const consume = action({ type: "CONSUME", bottleId: "assassin-potion-1", confirmed: true }, "服用第一瓶", false, "0行动 · 消耗所选原瓶");
    consume.reason = "需要度过四个完整普通周，第5周起可以服药。";
    const supply = "后续补给已申请；至少跨一周后才有独立新瓶，本周不能无限领取。指导120便士，成品660便士；两次真实劳务后余款60便士。";
    panel({ ...bottled(), actions: [consume], supplies: supply, digestion: "普通生活已完成3/4整周。" });
    expect(screen.getByText(supply)).toBeTruthy();
    expect(screen.getByText("普通生活已完成3/4整周。")).toBeTruthy();
    expect(screen.getByText(consume.reason)).toBeTruthy();
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /领取|制造|调配/ })).toBeNull();
  });

  it("shows only public work records and keeps the selected case when availability changes", async () => {
    const value = assassin({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("region", { name: "练习原稿的归属与持有" })).toBeNull();
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "shadow-cross");
    rerender(<AssassinPanel assassin={{ ...value, actions: [action({ type: "OBSERVE", caseId: "dim-sign" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("shadow-cross");
    expect(screen.getByRole("region", { name: "当前刺客实践" }).textContent).toContain("亮处与声响");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches both exact methods and never invents a prepared state or acquired draft", async () => {
    const list = cases(); list[1] = { ...list[1]!, status: "OBSERVED", observations: ["导师已实际打开原楼梯。"] };
    const choices = [action({ type: "PREPARE", caseId: "upper-draft", method: "SKILL" }, "准备轻盈身法"), action({ type: "PREPARE", caseId: "upper-draft", method: "ORDINARY" }, "准备普通楼梯")];
    const { onCommand } = panel(assassin({ promoted: true, cases: list, actions: choices }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "upper-draft");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "练习原稿的归属与持有" })).toBeNull();
  });

  it("forces the upper-platform case while preserving the public zero-resource ordinary return", async () => {
    const { onCommand, rerender } = panel(assassin({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "shadow-cross");
    rerender(<AssassinPanel assassin={upstairs()} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("upper-draft"); expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "当前刺客实践" }).textContent).toContain("当前位置：上层平台");
    const lightness = screen.getByRole("button", { name: /^以轻盈身法返回原起点/ }) as HTMLButtonElement;
    const stairs = screen.getByRole("button", { name: /^沿已打开的普通楼梯返回原起点/ }) as HTMLButtonElement;
    expect(lightness.disabled).toBe(true); expect(stairs.disabled).toBe(false);
    expect(screen.getByText("灵性不足2点；仍可沿已打开的普通楼梯返回。")).toBeTruthy();
    await userEvent.click(stairs);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "upper-draft", route: "STAIRS" });
    expect(screen.getByText("你实际持有")).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前刺客实践" }).textContent).toContain("当前位置：上层平台");
  });

  it("dispatches lightness separately and keeps the exact selected case after an actual return", async () => {
    const value = upstairs(); value.actions[0] = { ...value.actions[0]!, enabled: true, reason: null };
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^以轻盈身法返回原起点/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "upper-draft", route: "LIGHTNESS" });
    const returned = { ...value, insideCase: false, draft: { ...draft, location: "原起点，本人手中的原稿", version: 3 },
      cases: value.cases.map((entry) => entry.id === "upper-draft" ? { ...entry, position: "原起点", result: "你实际回到原起点；原稿仍由你保管。" } : entry), actions: [] };
    rerender(<AssassinPanel assassin={returned} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("upper-draft");
    expect(screen.getByText("你实际持有")).toBeTruthy();
    expect(screen.getByText("原起点，本人手中的原稿")).toBeTruthy();
    expect(screen.getByText("诺艾拉·温瑟")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /交还|卖出|装备/ })).toBeNull();
  });

  it("copies custody and location labels exactly, including a deceased holder", () => {
    panel(assassin({ promoted: true, draft: { ...draft, custodian: "本人遗体", location: "本人实际倒地处的遗体手中" } }));
    const record = within(screen.getByRole("region", { name: "练习原稿的归属与持有" }));
    expect(record.getByText("本人遗体")).toBeTruthy();
    expect(record.getByText("本人实际倒地处的遗体手中")).toBeTruthy();
    expect(record.getByText("诺艾拉·温瑟")).toBeTruthy();
  });

  it("shows only the selected case actions and authoritative blocked reasons", async () => {
    const entries = [action({ type: "OBSERVE", caseId: "dim-sign" }, "观察暗处标记"), action({ type: "PREPARE", caseId: "upper-draft", method: "SKILL" }, "准备上层检验", false)];
    entries[1]!.reason = "先确认原楼梯已打开并观察落点。";
    const { onCommand } = panel(assassin({ promoted: true, cases: cases(), actions: entries }));
    expect(screen.getByRole("button", { name: /^观察暗处标记/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^准备上层检验/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "upper-draft");
    expect(screen.queryByRole("button", { name: /^观察暗处标记/ })).toBeNull();
    const button = screen.getByRole("button", { name: /^准备上层检验/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/先确认原楼梯已打开/).length).toBeGreaterThan(0);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses a callback-free history after choosing another route", async () => {
    const state = fixture(false, { assassin: bottled(), progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } });
    const api = bridge(state); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "刺客经历" }));
    const history = within(screen.getByRole("region", { name: "刺客渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.getByText("来源：诺艾拉·温瑟独立留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains source, work and actual custody records in history with no controls", () => {
    render(<AssassinHistory assassin={{ ...bottled(), draft, cases: cases() }} />);
    expect(screen.getByText("诺艾拉·温瑟")).toBeTruthy();
    expect(screen.getByText("你实际持有")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "RETURN", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic effects", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: AssassinCommand = type === "CONSUME" ? { type, bottleId: "assassin-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "RETURN" ? { type, caseId: "upper-draft", route: "STAIRS" }
      : type === "PREPARE" ? { type, caseId: "dim-sign", method: "SKILL" } : { type, caseId: "dim-sign" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "RETURN"].includes(type);
    const state = fixture(isLife, { assassin: type === "CONSUME" ? bottled() : assassin({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, assassin: { ...state.assassin, actions: [], bottles: state.assassin.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openAssassin();
    if (type === "RETURN") await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "upper-draft");
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶刺客魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "刺客模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("刺客模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "ASSASSIN", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads upstairs at zero AP and zero mind with the return dossier forced open", async () => {
    const state = fixture(true, { assassin: upstairs(), seer: { ...base.seer, discovered: true }, mind: 0, spirituality: 0, actionsRemaining: 0, canAct: false });
    const api = bridge(state); await enter(api);
    await screen.findByRole("region", { name: "刺客成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先从上层平台实际返回");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    const stairs = screen.getByRole("button", { name: /^沿已打开的普通楼梯返回原起点/ }) as HTMLButtonElement;
    expect(stairs.disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a failed lightness return upstairs and exposes stairs after the committed resource change", async () => {
    const value = upstairs(); value.actions[0] = { ...value.actions[0]!, enabled: true, reason: null };
    const state = fixture(true, { assassin: value, actionsRemaining: 0, spirituality: 2 });
    const next = { ...state, revision: state.revision + 1, spirituality: 0, assassin: upstairs() };
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(api); await screen.findByRole("region", { name: "刺客成长下一步" });
    const button = screen.getByRole("button", { name: /^以轻盈身法返回原起点/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "LIGHTNESS" } });
    await act(async () => { finish(receipt(next, envelope)); });
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("upper-draft");
    expect(screen.getByText("你实际持有")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^以轻盈身法返回原起点/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^沿已打开的普通楼梯返回原起点/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });

  it("retains draft custody and upper position on failed save, then retries the same return envelope", async () => {
    const state = fixture(true, { assassin: upstairs(), actionsRemaining: 0, mind: 0, spirituality: 0 });
    const next: SliceProjection = { ...state, revision: state.revision + 1, assassin: { ...upstairs(), insideCase: false,
      draft: { ...draft, location: "原起点，本人手中", version: 3 }, actions: [],
      cases: upstairs().cases.map((entry) => entry.id === "upper-draft" ? { ...entry, position: "原起点", result: "你已实际沿普通楼梯返回，原稿仍在本人手中。" } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "返回尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "刺客成长下一步" });
    await userEvent.click(screen.getByRole("button", { name: /^沿已打开的普通楼梯返回原起点/ }));
    expect(screen.getByRole("alert").textContent).toContain("返回尚未保存");
    expect(screen.getByText("上层平台，本人手中的原稿")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^沿已打开的普通楼梯返回原起点/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(screen.getByText("原起点，本人手中")).toBeTruthy();
    expect(screen.getByText("你实际持有")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("upper-draft");
  });
});
