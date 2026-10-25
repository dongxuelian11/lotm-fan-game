/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CLOWN_ABILITY_IDS, type ClownAction, type ClownProjection } from "../../src/domain/clown/types";
import { SEER_ABILITY_IDS } from "../../src/domain/seer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ClownPanel } from "../../src/renderer/ClownPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const learn: ClownAction = {
  id: "learn", label: "请指导者讲解小丑配方", cost: "1行动 · 180便士", enabled: true,
  reason: null, command: { type: "LEARN_FORMULA" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function clown(patch: Partial<ClownProjection> = {}): ClownProjection {
  return {
    title: "小丑之路", discovered: true, formulaKnown: false, promoted: false,
    formula: [], actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "领域前提原文：占卜家消化100，晋升后满6整周。", pollution: 3, risk,
    paperStock: 0, paperSheets: 0, paperSpent: 0, ...patch,
  };
}
function bottled(): ClownProjection {
  return clown({
    formulaKnown: true,
    actions: ["clown-bottle-a", "clown-bottle-b"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "clown-bottle-a", title: "第一瓶小丑魔药", source: "实际劳务第一批", status: "已调配", chance: 71, command: { type: "CONSUME", bottleId: "clown-bottle-a", confirmed: true } },
      { id: "clown-bottle-b", title: "第二瓶小丑魔药", source: "实际采购第二批", status: "已调配", chance: 43, command: { type: "CONSUME", bottleId: "clown-bottle-b", confirmed: true } },
    ],
  });
}
function panel(value: ClownProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ClownPanel clown={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("clown-renderer-run", sliceDefaultCreationSelection, "clown-renderer-seed");
  raw.week = 16;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.seer.discovered = true;
  raw.seer.formulaKnown = true;
  raw.progression = {
    pathwayId: "diviner", sequence, acting: sequence === 9 ? 100 : 0, promotionWeek: 5,
    mastery: Object.fromEntries(SEER_ABILITY_IDS.map((id) => [id, 12])),
  };
  if (sequence === 8) {
    Object.assign(raw.progression.mastery, Object.fromEntries(CLOWN_ABILITY_IDS.map((id) => [id, 0])));
    raw.clown.formulaKnown = true;
    raw.clown.promotionWeek = 15;
    raw.clown.seerActingAtPromotion = 100;
    raw.clown.paperStock = 20;
    raw.clown.paperSheets = 7;
    raw.clown.paperSpent = 3;
  }
  return { ...projectSliceState(raw), canAct: true, actionBlockedReason: null, ...patch };
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
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
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
async function openClown() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "小丑晋升" }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Clown progression dossier", () => {
  it("pairs preparation costs with exact current resources without executing on focus", async () => {
    const value = clown(), snapshot = JSON.stringify(value);
    const { onCommand } = panel(value);
    expect(screen.getByLabelText("晋升准备当前资源").textContent).toContain(resources.cash);
    expect(screen.getByLabelText("晋升准备当前资源").textContent).toContain(`剩余行动${resources.actionsRemaining}`);
    const action = screen.getByRole("button", { name: /请指导者讲解小丑配方/ });
    expect(within(action).getByText(learn.cost)).toBeTruthy();
    await userEvent.tab();
    expect(document.activeElement).toBe(action);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(action);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(learn.command);
    expect(JSON.stringify(value)).toBe(snapshot);
  });

  it("does not add preparation budgeting to promoted practice", () => {
    panel(clown({ promoted: true }));
    expect(screen.queryByLabelText("晋升准备当前资源")).toBeNull();
  });

  it("shows the public prerequisite without revealing an unknown formula or future abilities", () => {
    const value = clown({
      formula: [{ name: "未公开测试材料", quantity: 7, unit: "份" }],
      abilities: [{ id: "future", label: "未获得测试能力", description: "未来内容", mastery: 0 }],
    });
    panel(value);
    expect(screen.getByText(value.digestion)).toBeTruthy();
    expect(screen.queryByText("未公开测试材料")).toBeNull();
    expect(screen.queryByText(/未获得测试能力/)).toBeNull();
    expect((screen.getByText("查看服用风险与四档结果").closest("details") as HTMLDetailsElement).open).toBe(false);
  });

  it("renders public story, action costs and disabled reasons verbatim", async () => {
    const practice: ClownAction = { id: "practice", label: "领域实践原文", cost: "领域成本：1行动 · 2灵性", enabled: true, reason: null, command: { type: "PRACTICE", practiceId: "public-practice" } };
    const fight: ClownAction = { id: "fight", label: "领域护送原文", cost: "领域战斗成本原文", enabled: false, reason: "领域阻止原因：先处理当前事件", command: { type: "RESCUE_FIGHT" } };
    const { onCommand } = panel(clown({ promoted: true, story: "仅由投影提供的现场情况。", actions: [practice, fight] }));
    expect(screen.getByRole("region", { name: "当前小丑情境" }).textContent).toContain("仅由投影提供的现场情况。");
    const disabled = screen.getByRole("button", { name: /领域护送原文/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    expect(within(disabled).getByText(fight.cost)).toBeTruthy();
    expect(screen.getByText(fight.reason!)).toBeTruthy();
    fireEvent.click(disabled);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /领域实践原文/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(practice.command);
  });

  it("cancels free, focuses the selected bottle, and confirms only that exact bottle once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶小丑魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶小丑魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶小丑魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶小丑魔药」/ }));
    expect(screen.getByText("clown-bottle-b")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：实际采购第二批")).toBeTruthy();
    expect(screen.getByRole("region", { name: "小丑服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶小丑魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "clown-bottle-b", confirmed: true });
  });

  it.each(["占卜家扮演96/100，尚未消化", "晋升后已度过5/6整周，尚不能服药", "当前周目已结束"]) (
    "keeps the bottle disabled for the projected reason: %s", (reason) => {
      const value = bottled();
      value.actions = value.actions.map((action) => ({ ...action, enabled: false, reason }));
      const { onCommand } = panel(value);
      const bottle = screen.getByRole("button", { name: /查看并准备服用「第二瓶小丑魔药」/ }) as HTMLButtonElement;
      expect(bottle.disabled).toBe(true);
      expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
      fireEvent.click(bottle);
      expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it("refreshes resource and risk changes before confirmation and cannot consume an unavailable bottle", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶小丑魔药」/ }));
    const changed = { ...value, risk: "新公开风险", actions: value.actions.map((action) => ({ ...action, enabled: false, reason: "现在无法服药" })) };
    rerender(<ClownPanel clown={changed} resources={{ ...resources, mind: 4 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("4 / 100")).toBeTruthy();
    expect(screen.getByText("新公开风险")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶小丑魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onCommand).not.toHaveBeenCalled();
    rerender(<ClownPanel clown={{ ...value, bottles: [value.bottles[1]!] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(screen.getByRole("button", { name: /查看并准备服用「第二瓶小丑魔药」/ })).toBeTruthy();
  });

  it("defaults S9 to the existing eight commissions and allows a separate S8 preparation page", async () => {
    const state = fixture();
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("option")).toHaveLength(8);
    await userEvent.click(screen.getByRole("button", { name: "小丑晋升" }));
    expect(screen.getByRole("region", { name: "小丑成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    expect(screen.getAllByRole("option")).toHaveLength(8);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Clown, shows projected paper and 45 spirituality, and retains nine folded abilities", async () => {
    const state = fixture(8);
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(/小丑 · 序列8 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe("45");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: "小丑晋升" }).getAttribute("aria-pressed")).toBe("true");
    const paper = screen.getByRole("region", { name: "小丑纸张库存" });
    expect(paper.textContent).toContain("7 张");
    expect(paper.textContent).toContain("店内剩余 20 张");
    expect(paper.textContent).toContain("已使用 3 张");
    const abilities = screen.getByText("能力与消化 · 9 项能力").closest("details") as HTMLDetailsElement;
    expect(abilities.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 9 项能力"));
    expect(within(abilities).getByText("灵视 · 掌握 12")).toBeTruthy();
    expect(within(abilities).getByText("纸张飞刀 · 掌握 0")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    expect(screen.getAllByRole("option")).toHaveLength(8);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("sends one complete typed paper purchase and keeps the dossier locked while saving", async () => {
    const state = fixture(8);
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const saved = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(saved);
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const purchase = screen.getByRole("button", { name: /购买10张纸/ });
    expect(purchase.textContent).toContain("0行动 · 10便士");
    fireEvent.click(purchase);
    fireEvent.click(purchase);
    expect(submit).toHaveBeenCalledTimes(1);
    const envelope = submit.mock.calls[0]![0];
    expect(envelope).toEqual({ intentId: expect.any(String), runId: state.runId, expectedRevision: state.revision, payload: { type: "CLOWN", command: { type: "BUY_PAPER" } } });
    expect((screen.getByRole("button", { name: "占卜家经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finish(receipt({ ...state, revision: state.revision + 1 }, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("shows finite paper depletion and its projected purchase restriction", () => {
    const { onCommand } = panel(clown({ promoted: true, paperStock: 0, paperSheets: 0, paperSpent: 30,
      actions: [{ id: "paper", label: "纸张已售罄", cost: "0行动 · 供应方剩0张", enabled: false, reason: "这一批纸不会自动补货。", command: { type: "BUY_PAPER" } }],
    }));
    const inventory = screen.getByRole("region", { name: "小丑纸张库存" });
    expect(inventory.textContent).toContain("0 张");
    expect(inventory.textContent).toContain("已使用 30 张");
    const purchase = screen.getByRole("button", { name: /纸张已售罄/ }) as HTMLButtonElement;
    expect(purchase.disabled).toBe(true);
    expect(screen.getByText("这一批纸不会自动补货。")).toBeTruthy();
    fireEvent.click(purchase);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("opens the existing full-screen combat from the public rescue command and shows paper there", async () => {
    const state = fixture(8);
    state.clown.actions = [{ id: "rescue", label: "介入公开护送冲突", cost: "1行动 · 可能受伤或死亡", enabled: true, reason: null, command: { type: "RESCUE_FIGHT" } }];
    const next: SliceProjection = { ...state, revision: state.revision + 1, combat: {
      title: "码头巷口 · 护送冲突", round: 1, enemyName: "公开的短棍持有者", enemyHealth: 100,
      enemyStatus: "RESISTING", playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
      consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [{ id: "ATTACK", label: "进攻", description: "当前公开姿态说明。" }], lastRound: null,
    } };
    const value = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: /介入公开护送冲突/ }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "CLOWN", command: { type: "RESCUE_FIGHT" } });
    const battle = await screen.findByRole("dialog", { name: "码头巷口 · 护送冲突" });
    expect(within(battle).getByText(/灵性 15 \/ 45/)).toBeTruthy();
    expect(within(battle).getByText("纸张 7 张")).toBeTruthy();
    expect(within(battle).getByRole("heading", { name: "公开的短棍持有者" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it.each(["ordinary", "legacy"] as const)("hides the S8 preparation entry for %s public projections", async (kind) => {
    const state = kind === "ordinary"
      ? projectSliceState(createSliceRun("ordinary-clown-ui", { ...sliceDefaultCreationSelection, displayName: "艾琳" }, "ordinary-clown-ui"))
      : fixture();
    if (kind === "legacy") delete (state as Partial<SliceProjection>).clown;
    state.activeEvent = null;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    expect(screen.queryByRole("region", { name: "小丑成长下一步" })).toBeNull();
  });

  it("retries the exact failed envelope and original bottle without creating a second consumption", async () => {
    const state = fixture(9, { clown: bottled(), actionsRemaining: 0 });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openClown();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶小丑魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶小丑魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /正在结算并保存/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "小丑模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("小丑模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶小丑魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "小丑晋升" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CLOWN", command: { type: "CONSUME", bottleId: "clown-bottle-b", confirmed: true } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
