/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { MARAUDER_ABILITIES, MARAUDER_CONSUMPTION_RISK } from "../../src/domain/marauder/content";
import type { MarauderAction, MarauderCommand, MarauderProjection } from "../../src/domain/marauder/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { MarauderHistory, MarauderPanel } from "../../src/renderer/MarauderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: MarauderCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): MarauderAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访独立失物登记员艾德温·洛克");
function marauder(patch: Partial<MarauderProjection> = {}): MarauderProjection {
  return {
    title: "偷盗者之路", discovered: false, guidanceKnown: false, promoted: false,
    dispute: { stage: "UNSEEN", title: "维修院 · 原短棍争端", description: "完成三案后可了解这一可选争端。", weapon: null, attention: 0, outcome: null },
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: MARAUDER_CONSUMPTION_RISK, cases: [], originals: [], environment: "", ...patch,
  };
}
function bottled(): MarauderProjection {
  return marauder({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；两次实际劳动后60便士，指导120便士。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["marauder-potion-1", "marauder-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "marauder-potion-1", title: "第一瓶偷盗者魔药", source: "艾德温·洛克独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "marauder-potion-1", confirmed: true } },
      { id: "marauder-potion-2", title: "第二瓶偷盗者魔药", source: "艾德温·洛克独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "marauder-potion-2", confirmed: true } },
      { id: "marauder-potion-3", title: "第三瓶偷盗者魔药", source: "艾德温·洛克独立留存的第三原瓶", status: "登记员保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "marauder-potion-3", confirmed: true } },
    ],
  });
}
function cases(): MarauderProjection["cases"] {
  return [
    { id: "training-purse", title: "自愿钱袋练习", story: "原主人同意本次练习，结束须交还原物。", observations: [], preparation: null, result: null, status: "AVAILABLE" },
    { id: "fallen-token", title: "失落的铜牌", story: "露茜委托找回自己的原铜牌。", observations: [], preparation: null, result: null, status: "AVAILABLE" },
    { id: "sealed-dispatch", title: "柜台上的原封信", story: "只许可普通交接，擅自取得会被柜员注意。", observations: [], preparation: null, result: null, status: "AVAILABLE" },
  ];
}
const letter: MarauderProjection["originals"][number] = {
  id: "sealed-letter", label: "安娜的原封信", owner: "委托人安娜", custodian: "你暂时持有",
  location: "你手中的原信", sealed: true, version: 2,
};
function panel(value: MarauderProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MarauderPanel marauder={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("marauder-renderer-run", sliceDefaultCreationSelection, "marauder-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    marauder: marauder({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "偷盗者 · 序列9" : "偷盗者之路",
      actions: promoted ? [] : [discover], abilities: promoted ? MARAUDER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "error" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openMarauder() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^偷盗者(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Marauder sequence-nine original-object dossier", () => {
  it("shows the twelfth route only in the explicit selector and remembers the ordinary choice", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("button", { name: "偷盗者之路" })).toBeNull();
    await openMarauder();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "偷盗者之路" }).textContent).toContain("眼前原物");
    expect(screen.getByRole("region", { name: "偷盗者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /诈骗师|解密学者|盗火人|宝物感应/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "偷盗者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("automatically selects the promoted route and exposes only three sourced S9 training categories", async () => {
    await enter(bridge(fixture(true)));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const abilities = screen.getByRole("region", { name: "偷盗者能力与消化" });
    expect(abilities.textContent).toContain("3 项能力");
    for (const ability of MARAUDER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
  });

  it("shows distinct original sources and public supply terms without inventing a recipe", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "偷盗者成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
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
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶偷盗者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("marauder-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：艾德温·洛克独立留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "偷盗者服用风险与四档结果" }).textContent).toContain(MARAUDER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶偷盗者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "marauder-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MarauderPanel marauder={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility and costs without locally calculating readiness", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "原瓶仍在，但需要先恢复身心。";
    rerender(<MarauderPanel marauder={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶偷盗者魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getAllByText("0行动 · 独立确认 · 消耗这瓶魔药")).toHaveLength(2);
  });

  it("leaves unobserved originals absent and preserves the selected case without suggesting an outcome", async () => {
    const { onCommand } = panel(marauder({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.queryByRole("region", { name: "已观察原物的归属与持有" })).toBeNull();
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择原物实践" }), "sealed-dispatch");
    expect(screen.getByRole("region", { name: "当前原物实践" }).textContent).toContain("只许可普通交接");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches both exact preparation methods without optimistic custody or preparation", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "OBSERVED", observations: ["原主人已同意练习。"] };
    const choices = [action({ type: "PREPARE", caseId: "training-purse", method: "DEXTERITY" }, "准备灵巧练习"), action({ type: "PREPARE", caseId: "training-purse", method: "ORDINARY" }, "准备普通交接")];
    const { onCommand } = panel(marauder({ promoted: true, cases: list, actions: choices }));
    await userEvent.click(screen.getByRole("button", { name: /^准备灵巧练习/ }));
    await userEvent.click(screen.getByRole("button", { name: /^准备普通交接/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "已观察原物的归属与持有" })).toBeNull();
  });

  it("keeps ownership, custody and sealed contents separate until the authoritative return", async () => {
    const list = cases(); list[2] = { ...list[2]!, status: "EXAMINED", result: "原信在你手中，柜员已注意；没有打开封套。" };
    const returning = action({ type: "RETURN", caseId: "sealed-dispatch" }, "实际归还原封信", true, "0行动 · 不耗灵性");
    const report = { ...action({ type: "REPORT", caseId: "sealed-dispatch", conclusion: "LIMITED" }, "报告有限经过", false), reason: "先归还原信。" };
    const value = marauder({ promoted: true, cases: list, originals: [letter], actions: [returning, report] });
    const { onCommand, rerender } = panel(value);
    const record = within(screen.getByRole("article", { name: "安娜的原封信" }));
    expect(record.getByText("委托人安娜")).toBeTruthy(); expect(record.getByText("你暂时持有")).toBeTruthy();
    expect(record.getByText("原封完整")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^报告有限经过/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际归还原封信/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(returning.command);
    expect(screen.getByText("你暂时持有")).toBeTruthy();
    rerender(<MarauderPanel marauder={{ ...value, originals: [{ ...letter, custodian: "委托人本人", location: "委托人收回保管", version: 3 }], actions: [{ ...report, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByText("你暂时持有")).toBeNull();
    expect(screen.getByText("委托人安娜")).toBeTruthy(); expect(screen.getByText("委托人本人")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^报告有限经过/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("allows zero-AP withdrawal before execution without inventing movement or a result", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "PREPARED", preparation: "已准备本次练习，原物未移动。" };
    const withdraw = action({ type: "WITHDRAW", caseId: "training-purse" }, "取消本次准备", true, "0行动 · 不耗灵性");
    const { onCommand } = panel(marauder({ promoted: true, cases: list, actions: [withdraw] }));
    await userEvent.click(screen.getByRole("button", { name: /^取消本次准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("原物未移动");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
  });

  it("uses a callback-free history when another route was chosen", async () => {
    const state = fixture(false, { marauder: bottled(), progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } });
    const api = bridge(state); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "偷盗者经历" }));
    const history = within(screen.getByRole("region", { name: "偷盗者渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.getByText("来源：艾德温·洛克独立留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains actual original records and source history with no mutation controls", () => {
    render(<MarauderHistory marauder={{ ...bottled(), originals: [letter], cases: cases() }} />);
    expect(screen.getByText("委托人安娜")).toBeTruthy(); expect(screen.getByText("你暂时持有")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "RETURN", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic effects", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: MarauderCommand = type === "CONSUME" ? { type, bottleId: "marauder-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "training-purse", method: "DEXTERITY" }
      : type === "REPORT" ? { type, caseId: "training-purse", conclusion: "CERTAIN" } : { type, caseId: "training-purse" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "RETURN", "WITHDRAW", "RECEIVE_SUPPLY"].includes(type);
    const state = fixture(isLife, { marauder: type === "CONSUME" ? bottled() : marauder({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit; await enter(api); await openMarauder();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶偷盗者魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "偷盗者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("偷盗者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MARAUDER", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("shows the committed original change only after a successful receipt and reopening", async () => {
    const list = cases(); list[2] = { ...list[2]!, status: "PREPARED", preparation: "已选择普通交接；原信仍在柜台。" };
    const performing = action({ type: "PERFORM", caseId: "sealed-dispatch" }, "实际普通交接");
    const state = fixture(true, { marauder: marauder({ promoted: true, cases: list, originals: [{ ...letter, custodian: "柜员保管", location: "原柜台", version: 1 }], actions: [performing] }) });
    const next: SliceProjection = { ...state, revision: state.revision + 1, marauder: {
      ...state.marauder, originals: [letter], actions: [],
      cases: list.map((entry) => entry.id === "sealed-dispatch" ? { ...entry, status: "EXAMINED", result: "柜员已把这封原信交给你；原封仍完整。" } : entry),
    } };
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(api); await openMarauder(); await userEvent.click(screen.getByRole("button", { name: /^实际普通交接/ }));
    expect(screen.getByText("柜员保管")).toBeTruthy(); expect(screen.queryByText("你暂时持有")).toBeNull();
    const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
    await act(async () => { finish(receipt(next, envelope)); });
    await openMarauder();
    expect(screen.getByText("你暂时持有")).toBeTruthy(); expect(screen.getByText("委托人安娜")).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择原物实践" }), "sealed-dispatch");
    expect(screen.getByRole("region", { name: "实际执行与报告记录" }).textContent).toContain("原封仍完整");
  });
});
