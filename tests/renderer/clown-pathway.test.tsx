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
import { SliceApp, sliceMoney, clownLifeGuidance } from "../../src/renderer/SliceApp";
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
const scrollIntoView = vi.fn();
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  scrollIntoView.mockClear();
});
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Clown progression dossier", () => {
  it.each([0, 64, 100])("shows current acting %s on a separate scale without changing historical digestion", (acting) => {
    const value = clown({ promoted: true, acting, digestion: "占卜家100/100已保留；能力掌握分别记录。" });
    const { rerender } = render(<ClownPanel clown={value} currentSequence resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    const meter = screen.getByRole("meter", { name: "小丑扮演进度" });
    expect(meter.getAttribute("value")).toBe(String(acting));
    expect(meter.getAttribute("max")).toBe("100");
    expect(screen.getByText(value.digestion)).toBeTruthy();
    rerender(<ClownPanel clown={value} resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.queryByRole("meter")).toBeNull();
    expect(within(screen.getByRole("region", { name: "小丑成长下一步" })).getByText(`扮演进度 ${acting} · 消化：${value.digestion}`)).toBeTruthy();
    rerender(<ClownPanel clown={clown()} currentSequence resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it.each(["RETREATED", "RESCUED", "LOST"] as const)("does not offer terminal %s escort from the life sidebar", async rescueOutcome => {
    const state = fixture(8);
    state.nextStep = "旧通用提示：可进行实践与护送。";
    state.clown.rescueOutcome = rescueOutcome;
    const available = state.clown.actions.find(a => a.command.type === "PRACTICE" && a.enabled)!;
    expect(clownLifeGuidance(state)).toContain(`当前可实践「${available.label}」`);
    expect(clownLifeGuidance(state)).toContain("不能再次介入");
    await enter(bridge(state));
    expect(within(screen.getByRole("region", { name: "当前任务与线索" })).getByText(clownLifeGuidance(state))).toBeTruthy();
    state.clown.actions = state.clown.actions.map(a => ({ ...a, enabled: false }));
    expect(clownLifeGuidance(state)).toContain("返回日常安排工作或休养");
    expect(clownLifeGuidance(state)).not.toContain("当前可实践");
  });

  it("preserves original guidance for missing outcome, another sequence and blocked event/combat", () => {
    const state = fixture(8); state.nextStep = "当前权威指引";
    expect(clownLifeGuidance(state)).toBe(state.nextStep);
    state.clown.rescueOutcome = "RETREATED";
    state.canAct = false;
    expect(clownLifeGuidance(state)).not.toContain("当前可实践");
    expect(clownLifeGuidance({ ...state, progression: { ...state.progression, sequence: 9 } })).toBe(state.nextStep);
    expect(clownLifeGuidance({ ...state, activeEvent: { id: "pending" } as SliceProjection["activeEvent"] })).toBe(state.nextStep);
    expect(clownLifeGuidance({ ...state, combat: { round: 1 } as SliceProjection["combat"] })).toBe(state.nextStep);
    expect(clownLifeGuidance({ ...state, status: "DEAD" })).toBe(state.nextStep);
  });

  it("pairs preparation costs with exact current resources without executing on focus", async () => {
    const value = clown(), snapshot = JSON.stringify(value);
    const { onCommand, container } = panel(value);
    expect(container.querySelector(".clown-single-action")).toBeTruthy();
    expect(screen.queryByLabelText("小丑行动当前资源")).toBeNull();
    expect(container.querySelector(".clown-preparation-multiple")).toBeNull();
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

  it("puts prepared bottles before spare preparations in reading and keyboard order", async () => {
    const value = bottled();
    value.actions.push(learn);
    const { onCommand } = panel(value);
    const bottles = screen.getByRole("region", { name: "已调配的小丑魔药" });
    const preparations = screen.getByRole("group", { name: "小丑成长行动" });
    expect(bottles.compareDocumentPosition(preparations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.tab();
    expect(document.activeElement).toBe(within(bottles).getAllByRole("button")[0]);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses full-width multiple preparations without changing projected costs or locks", async () => {
    const locked = { ...learn, id: "locked", label: "备用批次", enabled: false, reason: "现有资源不足", cost: "领域原费用" };
    const { onCommand, container } = panel(clown({ actions: [learn, locked] }));
    expect(container.querySelector(".clown-preparation-multiple")).toBeTruthy();
    expect(screen.getByText(locked.cost)).toBeTruthy();
    expect(screen.getByText(locked.reason)).toBeTruthy();
    const disabled = screen.getByRole("button", { name: /备用批次/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    fireEvent.click(disabled);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /请指导者/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(learn.command);
  });

  it("does not add preparation budgeting to promoted practice", () => {
    panel(clown({ promoted: true }));
    expect(screen.queryByLabelText("晋升准备当前资源")).toBeNull();
    expect(screen.getByLabelText("小丑行动当前资源").textContent).toContain(resources.cash);
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

  it("separates ordinary practice, supplies, and courier choices while retaining exact commands", async () => {
    const paper: ClownAction = { id: "paper", label: "购买10张纸", cost: "0行动 · 10便士", enabled: true, reason: null, command: { type: "BUY_PAPER" } };
    const practice: ClownAction = { id: "practice", label: "练习身体控制", cost: "1行动 · 原训练叙事", enabled: true, reason: null, command: { type: "PRACTICE", practiceId: "body" } };
    const talk: ClownAction = { id: "talk", label: "当面交涉", cost: "1行动 · 意志难度14", enabled: true, reason: null, command: { type: "RESCUE_TALK" } };
    const fight: ClownAction = { id: "fight", label: "介入冲突", cost: "1行动 · 可能受伤或死亡", enabled: true, reason: null, command: { type: "RESCUE_FIGHT" } };
    const value = clown({ promoted: true, story: "快递员保管原包裹。", actions: [paper, practice, talk, fight] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).toContain(`下一步：${practice.label}`);
    expect(within(screen.getByRole("region", { name: "小丑纸张库存" })).getByRole("button", { name: /购买10张纸/ })).toBeTruthy();
    const ordinary = screen.getByRole("region", { name: "小丑日常实践" });
    expect(within(ordinary).getAllByRole("button")).toHaveLength(1);
    const escort = screen.getByRole("region", { name: "当前小丑情境" });
    expect(escort.textContent).toContain(value.story);
    expect(within(escort).getAllByRole("button")).toHaveLength(2);
    expect(within(escort).getByText(fight.cost)).toBeTruthy();
    await userEvent.click(within(escort).getByRole("button", { name: /当面交涉/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command);
    rerender(<ClownPanel clown={{ ...value, actions: [paper, { ...practice, enabled: false, reason: "本周已练习" }, talk, fight] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).toContain(`下一步：${talk.label}`);
    rerender(<ClownPanel clown={{ ...value, story: "护送已结束。", actions: [paper] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("group", { name: "护送处理方式" })).toBeNull();
    expect(screen.getByText("护送已结束。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前小丑情境" }).classList.contains("clown-escort-record")).toBe(false);
  });

  it.each([80, 100])("does not mistake supplies for growth after terminal escort at %i", (acting) => {
    const paper: ClownAction = { id: "paper", label: "购买10张纸", cost: "0行动 · 10便士", enabled: true, reason: null, command: { type: "BUY_PAPER" } };
    render(<ClownPanel clown={clown({ promoted: true, rescueOutcome: "RETREATED", acting, actions: [paper] })} currentSequence resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    const summary = screen.getByRole("region", { name: "小丑成长下一步" });
    expect(summary.textContent).not.toContain("下一步：购买");
    expect(summary.textContent).toContain(acting < 100 ? "补充纸张不会增加扮演" : "魔术师晋升条件");
    expect(screen.getByRole("button", { name: /购买10张纸/ })).toBeTruthy();
  });

  it("keeps a blocked practice's real reason instead of claiming practices are complete", () => {
    const practice: ClownAction = { id: "practice", label: "复核实践", cost: "1行动", enabled: false, reason: "本周已经尝试过，下周再练。", command: { type: "PRACTICE", practiceId: "quiet-support" } };
    render(<ClownPanel clown={clown({ promoted: true, rescueOutcome: "RETREATED", acting: 80, actions: [practice] })} currentSequence resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).toContain(practice.reason);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).not.toContain("当前实践已完成");
  });

  it("routes exhausted current growth back to daily life without inventing another practice", async () => {
    const state = fixture(8);
    state.progression.acting = 80;
    state.clown = { ...state.clown!, acting: 80, rescueOutcome: "RETREATED", actions: [] };
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText("当前实践已完成，扮演尚未满")).toBeTruthy();
    expect(screen.getByRole("button", { name: "安排日常行动" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("offers a projected retreat reflection ahead of supplies without reopening the escort", async () => {
    const reflection: ClownAction = { id: "retreat-reflection", label: "撤离后稳住自己的表情", cost: "1行动 · 意志难度12 · 成功扮演+20（上限100）；失败消耗行动，下周可重试。", enabled: true, reason: null, command: { type: "PRACTICE", practiceId: "retreat-reflection" } };
    const paper: ClownAction = { id: "paper", label: "购买10张纸", cost: "0行动 · 10便士", enabled: true, reason: null, command: { type: "BUY_PAPER" } };
    const onCommand = vi.fn();
    const value = clown({ promoted: true, rescueOutcome: "RETREATED", acting: 80, story: "护送未解决，包裹未转移。", actions: [paper, reflection] });
    const { rerender } = render(<ClownPanel clown={value} currentSequence resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).toContain(`下一步：${reflection.label}`);
    expect(screen.getByRole("region", { name: "当前小丑情境" }).textContent).toContain("已撤离 · 未解决");
    await userEvent.click(screen.getByRole("button", { name: new RegExp(reflection.label) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(reflection.command);
    rerender(<ClownPanel clown={{ ...value, actions: [paper, { ...reflection, enabled: false, reason: "本周已经尝试过，下周再练。" }] }} currentSequence resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "小丑成长下一步" }).textContent).toContain("下周再练");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(reflection.label) }));
    expect(onCommand).toHaveBeenCalledTimes(1);
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

  it("keeps ordered cross-week receipts, repeated titles and exact resources without charging on reopen", async () => {
    const state = fixture(8), value = bridge(state);
    const practice = state.clown.actions.find(action => action.command.type === "PRACTICE")!;
    const record = { id: "resource-test-result", week: state.week, title: "实践未能完成", text: "原纸已消耗，没有成长奖励。" };
    const records = [record,
      { id: "resource-test-growth", week: state.week, title: "能力有了长进", text: "另一项原有成长记录，不能替代失败。" },
      { id: "resource-test-living", week: state.week, title: "本周生活费", text: "已支付120便士，工作工资不重复入账。" },
      { id: "resource-test-next", week: state.week + 1, title: "新的一周", text: "日期推进7天，本周3次行动。" },
      { ...record, id: "resource-test-repeat", week: state.week + 1, text: "同名记录仍按原顺序显示。" },
    ];
    const next = { ...state, revision: state.revision + 1, actionsRemaining: state.actionsRemaining - 1,
      spirituality: state.spirituality - 1, cash: state.cash - 10,
      clown: { ...state.clown, acting: 16, paperSheets: state.clown.paperSheets - 1 },
      lastResult: record, chronicle: [...state.chronicle, ...records] };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementation(async envelope => receipt(next, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const budget = screen.getByLabelText("小丑行动当前资源");
    expect(budget.textContent).toContain(`剩余行动${state.actionsRemaining}`);
    expect(budget.textContent).toContain(`灵性${state.spirituality} / ${state.maxSpirituality}`);
    expect(budget.textContent).toContain(`随身纸张${state.clown.paperSheets} 张`);
    expect(within(screen.getByRole("button", { name: new RegExp(practice.label) })).getByText(practice.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(practice.label) }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "CLOWN", command: practice.command });
    expect(budget.textContent).toContain(`剩余行动${next.actionsRemaining}`);
    expect(budget.textContent).toContain(`灵性${next.spirituality} / ${next.maxSpirituality}`);
    expect(budget.textContent).toContain(`随身纸张${next.clown.paperSheets} 张`);
    expect(budget.textContent).toContain(`现金${sliceMoney(next.cash)}`);
    expect(screen.getByRole("meter", { name: "小丑扮演进度" }).getAttribute("value")).toBe("16");
    const feedback = screen.getByRole("status", { name: "本次行动结果" });
    expect(feedback.classList.contains("clown-action-feedback")).toBe(true);
    expect(feedback.textContent).toContain(record.text);
    const entries = within(feedback).getAllByRole("article");
    expect(entries).toHaveLength(records.length);
    entries.forEach((entry, i) => {
      expect(within(entry).getByRole("heading", { level: 3 }).textContent).toBe(records[i]!.title);
      expect(entry.querySelector("p")?.textContent).toBe(records[i]!.text);
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    const budgetText = budget.textContent;
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByLabelText("小丑行动当前资源").textContent).toBe(budgetText);
    expect(screen.getByRole("status", { name: "本次行动结果" }).textContent).toContain(record.text);
    expect(submit).toHaveBeenCalledTimes(1);
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


it.each([
  ['RESCUED', '已护送离开'], ['RETREATED', '已撤离 · 未解决'], ['LOST', '护送未完成'],
] as const)('presents authoritative %s escort outcome as a quiet record without changing story or actions', (rescueOutcome, heading) => {
  const story = '原有结果正文，保留原物与未知后续。';
  const { onCommand } = panel(clown({ promoted: true, rescueOutcome, story, actions: [] }));
  const record = screen.getByRole('region', { name: '当前小丑情境' });
  expect(record.classList.contains('clown-escort-record')).toBe(true);
  expect(within(record).getByText(heading)).toBeTruthy();
  expect(within(record).getByText(story)).toBeTruthy();
  expect(within(record).queryByRole('button')).toBeNull();
  expect(onCommand).not.toHaveBeenCalled();
});


describe("S6 current daily guidance reuses the dashboard route", () => {
  const stale = "首案卷宗已保存。可在非凡成长中接取俱乐部委托，也可工作、学习或休养。";
  function current(acting = 100) {
    const state = fixture(8);
    state.progression.sequence = 6; state.progression.acting = acting;
    state.faceless!.promoted = true; state.faceless!.acting = acting;
    state.nextStep = stale;
    return state;
  }
  it.each([50, 100])("shows the existing correct goal and opens its existing entry for acting %s without a command", async acting => {
    const state = current(acting), before = JSON.stringify(state), value = bridge(state);
    expect(clownLifeGuidance(state)).not.toContain("接取俱乐部委托");
    expect(clownLifeGuidance(state)).toContain(acting < 100 ? "实践当前能力，消化魔药" : "准备秘偶大师晋升");
    if (acting === 100) {
      expect(clownLifeGuidance(state)).toContain("12整周");
      expect(clownLifeGuidance(state)).toContain("成熟条件与费用仍以成长卷宗为准");
    }
    await enter(value);
    expect(within(screen.getByRole("region", { name: "当前任务与线索" })).getByText(clownLifeGuidance(state))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: acting < 100 ? "查看当前成长" : "查看秘偶大师晋升" }));
    expect(screen.getByRole("region", { name: acting < 100 ? "无面人成长下一步" : "秘偶大师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(["different-hint", "dead", "event", "combat", "health", "mind", "not-promoted", "missing-faceless", "other-sequence", "other-pathway"])("preserves authoritative guidance for %s", scenario => {
    const state = current();
    if (scenario === "different-hint") state.nextStep = "先处理当前公开事项。";
    if (scenario === "dead") state.status = "DEAD";
    if (scenario === "event") state.activeEvent = { id: "pending" } as SliceProjection["activeEvent"];
    if (scenario === "combat") state.combat = { round: 1 } as SliceProjection["combat"];
    if (scenario === "health") state.health = 0;
    if (scenario === "mind") state.mind = 0;
    if (scenario === "not-promoted") state.faceless!.promoted = false;
    if (scenario === "missing-faceless") Reflect.deleteProperty(state, "faceless");
    if (scenario === "other-sequence") state.progression.sequence = 7;
    if (scenario === "other-pathway") state.progression.pathwayId = "white-tower";
    expect(clownLifeGuidance(state)).toBe(state.nextStep);
  });
});

it('labels real bottle provenance and confirmation without changing the selected command or saved projection', async () => {
  const id = 'clown-batch-1:bottle';
  const command = { type: 'CONSUME', bottleId: id, confirmed: true } as const;
  const source = '占卜俱乐部指导者调配台，第16周；仅由clown-batch-1的七项材料调配，原瓶clown-batch-1:bottle';
  const value = clown({ formulaKnown: true, actions: [{ id: `consume-${id}`, label: '服用第1批小丑原瓶', cost: '0行动 · 独立确认', enabled: true, reason: null, command }],
    bottles: [{ id, title: '第1批 · 小丑魔药', source, status: '已调配，尚未服用', chance: 62, command }] });
  const snapshot = JSON.stringify(value);
  const { container, onCommand } = panel(value);
  const readableSource = '来源：占卜俱乐部指导者调配台，第16周；仅由第1批备料的七项材料调配，第1批小丑原瓶';
  expect(screen.getByText(readableSource)).toBeTruthy();
  expect(container.textContent).not.toContain('clown-batch-');
  const open = () => userEvent.click(screen.getByRole('button', { name: /查看并准备服用/ }));
  await open();
  expect(screen.getByRole('region', { name: '这瓶小丑魔药的服用确认' }).textContent).not.toContain('clown-batch-');
  expect(screen.getByText('第1批小丑原瓶')).toBeTruthy();
  expect(screen.getByText(readableSource)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: '暂不服用' }));
  expect(onCommand).not.toHaveBeenCalled();
  await open();
  await userEvent.click(screen.getByRole('button', { name: '确认服用「第1批 · 小丑魔药」' }));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
  expect(JSON.stringify(value)).toBe(snapshot);
});
