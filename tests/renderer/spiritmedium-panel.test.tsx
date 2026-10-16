/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SPIRITMEDIUM_ABILITIES, SPIRITMEDIUM_CONSUMPTION_RISK } from "../../src/domain/spiritmedium/content";
import { GRAVEDIGGER_ABILITIES } from "../../src/domain/gravedigger/content";
import { CORPSECOLLECTOR_ABILITIES } from "../../src/domain/corpsecollector/content";
import type { SpiritmediumAction, SpiritmediumCommand, SpiritmediumProjection } from "../../src/domain/spiritmedium/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SpiritmediumCorpsecollectorHistory, GravediggerHistory, SpiritmediumPanel } from "../../src/renderer/SpiritmediumPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: SpiritmediumAction = {
  id: "guidance", label: "学习通灵者服用指导", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = SPIRITMEDIUM_CONSUMPTION_RISK;
function spiritmedium(patch: Partial<SpiritmediumProjection> = {}): SpiritmediumProjection {
  return {
    title: "通灵者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "掘墓人扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): SpiritmediumProjection {
  return spiritmedium({
    guidanceKnown: true,
    supplies: "完整配方待核；新渠道三瓶独立成品，2010便士或完成4次劳动抵1800便士后付210便士；指导240便士。",
    actions: ["spiritmedium-potion-1", "spiritmedium-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "spiritmedium-potion-1", title: "第一瓶通灵者魔药", source: "墓园器具库交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "spiritmedium-potion-1", confirmed: true } },
      { id: "spiritmedium-potion-2", title: "第二瓶通灵者魔药", source: "墓园器具库交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "spiritmedium-potion-2", confirmed: true } },
      { id: "spiritmedium-potion-3", title: "第三瓶通灵者魔药", source: "墓园器具库交接的第三原瓶", status: "导师保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "spiritmedium-potion-3", confirmed: true } },
    ],
  });
}
function cases(): SpiritmediumProjection["cases"] {
  return ["lamp-spirit", "memento-question", "wind-assistance"].map((id, index) => ({
    id, title: `通灵实践${index + 1}`, story: `原现场对象与范围${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: SpiritmediumCommand, label = "观察本处现场", enabled = true, cost = "1行动 · 本案公开成本"): SpiritmediumAction {
  return {
    id: JSON.stringify(command), label, cost, enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: SpiritmediumProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SpiritmediumPanel spiritmedium={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("spiritmedium-renderer-run", sliceDefaultCreationSelection, "spiritmedium-renderer-seed");
  raw.week = 30;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    corpsecollector: { ...state.corpsecollector, discovered: sequence !== null, promoted: sequence !== null, acting: 100, actions: [] },
    gravedigger: { ...state.gravedigger, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7, acting: 100, actions: [] },
    spiritmedium: spiritmedium({
      promoted: sequence === 7, title: sequence === 7 ? "通灵者 · 序列7" : "通灵者晋升",
      actions: sequence === 7 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "death", sequence,
      mastery: {}, acting: sequence === 7 ? 0 : 100, promotionWeek: sequence === null ? null : 5,
    }, ...patch,
  };
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
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
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
async function openSpiritmedium() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Spiritmedium sequence seven dossier", () => {
  it("keeps eleven ordinary routes and hides S7 until death S8", async () => {
    let api = bridge(fixture(null));
    await enter(api); await openSpiritmedium();
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(22);
    expect(screen.getByRole("button", { name: "收尸人之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /掘墓人|通灵者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
    cleanup();
    api = bridge(fixture(9));
    await enter(api); await openSpiritmedium();
    expect(screen.getByRole("button", { name: "掘墓人晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /通灵者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults death S8 to the S7 candidate while preserving current S8 growth", async () => {
    const api = bridge(fixture(8));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await openSpiritmedium();
    expect(screen.getByRole("button", { name: "通灵者晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "通灵者成长下一步" }).textContent).toContain("掘墓人消化并度过八个完整序列8周");
    await userEvent.click(screen.getByRole("button", { name: "掘墓人成长" }));
    expect(screen.getByRole("region", { name: "掘墓人成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "通灵者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S7 and preserves both original lower histories without callbacks", async () => {
    const state = fixture(7);
    state.seer.discovered = true;
    state.corpsecollector.cases = [{ id: "unclaimed-body", title: "原编号核验", story: "原遗物由登记员保管", observations: ["原编号相符，身份仍未知"], preparation: "先前普通核对准备", result: "此前1次确定断言已保留并更正", status: "RESOLVED" }];
    state.corpsecollector.actions = [{ id: "stale-nine", label: "不得重做的收尸人行动", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "unclaimed-body" } }];
    state.gravedigger.cases = [{ id: "nearby-echo", title: "原微灵核验", story: "同一处原灵仍留原地", observations: ["原微灵意图仍未知"], preparation: "先前初步交流准备", result: "此前1次完整真相说法已保留并更正", status: "RESOLVED" }];
    state.gravedigger.actions = [{ id: "stale-eight", label: "不得重做的掘墓人行动", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "nearby-echo" } }];
    const original = JSON.stringify([state.corpsecollector, state.gravedigger]);
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`通灵者 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("通灵者 · 序列7 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openSpiritmedium();
    expect(screen.getByRole("button", { name: "通灵者成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    for (const [name, texts] of [["收尸人", ["原编号相符，身份仍未知", "先前普通核对准备", "此前1次确定断言已保留并更正"]], ["掘墓人", ["原微灵意图仍未知", "先前初步交流准备", "此前1次完整真相说法已保留并更正"]]] as const) {
      await userEvent.click(screen.getByRole("button", { name: `${name}经历` }));
      const history = screen.getByRole("region", { name: `${name}时期的经历` });
      for (const text of texts) expect(within(history).getByText(text)).toBeTruthy();
      expect(history.textContent).toContain("你已晋升通灵者");
      expect(within(history).queryByRole("button")).toBeNull();
      expect(screen.queryByText(/不得重做/)).toBeNull();
    }
    expect(JSON.stringify([state.corpsecollector, state.gravedigger])).toBe(original);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("does not synthesize an unavailable spirit method or hidden target from the third case", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "OBSERVED", observations: ["当前仅提供普通核对方法；原卡仍在原桌，尚未执行。"] };
    const ordinary = action({ type: "PREPARE", caseId: "wind-assistance", method: "ORDINARY" }, "准备原卡普通核对");
    const { onCommand } = panel(spiritmedium({ promoted: true, cases: list, actions: [ordinary] }));
    expect(screen.getByRole("region", { name: "当前通灵实践" }).textContent).toContain("原现场对象与范围3");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /灵体|死亡之眼|召唤|命令/ })).toBeNull();
    expect(screen.queryByText(/未解锁选项|隐藏选项|缺少.*灵体方法/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^准备原卡普通核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
  });

  it("never displays report controls before the projected examination exists", () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", observations: ["只见到原封记，尚未核验。"], preparation: "已准备有限仪式，尚未执行。" };
    const entries = [action({ type: "PERFORM", caseId: "lamp-spirit" }, "执行本次实际核验"), action({ type: "WITHDRAW", caseId: "lamp-spirit" }, "取消本次准备", true, "0行动")];
    panel(spiritmedium({ promoted: true, cases: list, actions: entries }));
    expect(screen.queryByRole("button", { name: /报告|命令/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    expect(screen.getByRole("region", { name: "通灵仪式、问答与借力边界" }).textContent).toContain("问答不能自动揭示全部真相");
    expect(screen.getByRole("region", { name: "通灵仪式、问答与借力边界" }).textContent).toContain("序列5的冥界之门不在本阶段开放");
  });

  it("keeps known other routes available as history without exposing spiritmedium there", async () => {
    const state = fixture(9, { progression: { pathwayId: "sun", sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.corpsecollector.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "太阳神官成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /通灵者/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "收尸人经历" }));
    expect(screen.getByText("已选择其它途径，这份收尸人渠道只供回看。")).toBeTruthy();
  });

  it("shows three sourced S7 originals and keeps an unknown recipe entirely absent", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应渲染的未知原料", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    const recipe = screen.getByRole("region", { name: "通灵者成品渠道与配方边界" });
    expect(recipe.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(recipe.textContent).not.toContain("黑斑青蛙");
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应渲染的未知原料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels with Escape or button for no cost and independently confirms exactly one original at zero AP", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶通灵者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("spiritmedium-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：墓园器具库交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "通灵者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶通灵者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "spiritmedium-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶通灵者魔药的服用确认" })).toBeTruthy();
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates a stale bottle confirmation when %s", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<SpiritmediumPanel spiritmedium={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses current projected eligibility inside an already-open confirmation", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<SpiritmediumPanel spiritmedium={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "需要先恢复身心。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶通灵者魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("需要先恢复身心。")).toBeTruthy();
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not recalculate maturity, cash or labour costs from renderer resources", () => {
    const value = bottled();
    const reason = "掘墓人消化尚未达100，晋升后尚未满8整周。";
    const actions: SpiritmediumAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "spiritmedium-potion-3" }, "取得导师原瓶", false, "2010便士，或实际劳动4/4后210便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 240便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("2010便士，或实际劳动4/4后210便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 240便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps unknown identity and causes unknown while case selection spends nothing", async () => {
    const { onCommand } = panel(spiritmedium({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.getByRole("region", { name: "已知原灵与通灵范围" }).textContent).toContain("不能预先认定");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能据此确定灵体所知、借力结果或隐藏身份");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "wind-assistance");
    expect(screen.getByRole("region", { name: "当前通灵实践" }).textContent).toContain("原现场对象与范围3");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents RITUAL and ORDINARY as equal choices and never fabricates preparation after a click", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", observations: ["原灯仍在原处，尚未取得灵的回应。"] };
    const choices = [action({ type: "PREPARE", caseId: "lamp-spirit", method: "RITUAL" }, "准备原灯附近的有限仪式"), action({ type: "PREPARE", caseId: "lamp-spirit", method: "ORDINARY" }, "准备普通记录核对")];
    const { onCommand } = panel(spiritmedium({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "通灵者成长下一步" });
    expect(summary.textContent).toContain("从本次可用方法中选择");
    const boundaries = screen.getByRole("region", { name: "通灵仪式、问答与借力边界" });
    expect(boundaries.textContent).toContain("仪式消耗3灵性，普通核验不消耗灵性");
    expect(boundaries.textContent).toContain("序列6的灵界信使");
    for (const entry of choices) expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通记录核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
  });

  it("separates actual observations, prepared method and returned report without optimistic facts", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "PREPARED", observations: ["原簿只有归还记录，后续经历未知。"], preparation: "已选普通记录核对，原簿仍由看护者保管。" };
    const { onCommand, rerender } = panel(spiritmedium({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "memento-question");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain(list[1]!.observations[0]);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).not.toContain(list[1]!.preparation);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[1]!.preparation);
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    list[1] = { ...list[1]!, status: "EXAMINED", preparation: null, result: "原核查完成，等待你选择报告。" };
    const reports = [action({ type: "REPORT", caseId: "memento-question", conclusion: "LIMITED" }, "提交所见与未知"), action({ type: "REPORT", caseId: "memento-question", conclusion: "COMPLETE" }, "宣称这条片段已揭示全部真相")];
    rerender(<SpiritmediumPanel spiritmedium={spiritmedium({ promoted: true, cases: list, actions: reports })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前通灵实践" }).textContent).toContain("已核验，尚待报告");
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("等待你选择报告");
    expect(screen.queryByRole("button", { name: /自动|正确答案|揭示真相/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^宣称这条片段已揭示全部真相/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(reports[1]!.command);
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("等待你选择报告");
  });

  it("retains a mistaken complete-truth assertion and its later correction exactly as projected", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "EXAMINED", observations: ["原卡仅在本次许可范围内移动，不能认定其它原物也可被搬运。"], result: "此前完整真相说法被指出证据不足；原核查保留，可作有限报告。" };
    const correction = action({ type: "REPORT", caseId: "wind-assistance", conclusion: "LIMITED" }, "提交所见与未知，保留进一步检查");
    const { onCommand, rerender } = panel(spiritmedium({ promoted: true, cases: list, actions: [correction] }));
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("此前完整真相说法被指出证据不足");
    await userEvent.click(screen.getByRole("button", { name: /^提交所见与未知/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(correction.command);
    list[2] = { ...list[2]!, status: "RESOLVED", result: "已如实交回有限观察。此前1次完整真相说法已保留为证据不足并更正。" };
    rerender(<SpiritmediumPanel spiritmedium={spiritmedium({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "wind-assistance");
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toBe(`实际核验与报告记录${list[2]!.result}`);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能认定其它原物也可被搬运");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the original paper on its recorded surface until a committed result is returned", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "PREPARED", observations: ["原卡在原桌，原托盘空着。"], preparation: "本次准备普通搬动这一张原卡。" };
    const perform = action({ type: "PERFORM", caseId: "wind-assistance" }, "执行原卡搬动", true, "1行动 · 不消耗灵性");
    const { onCommand, rerender } = panel(spiritmedium({ promoted: true, cases: list, actions: [perform] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "wind-assistance");
    await userEvent.click(screen.getByRole("button", { name: /^执行原卡搬动/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("原卡在原桌");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    list[2] = { ...list[2]!, status: "OBSERVED", preparation: null, result: "实际核验未成，原卡仍在原桌，下周可重试。" };
    rerender(<SpiritmediumPanel spiritmedium={spiritmedium({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("原卡仍在原桌");
    list[2] = { ...list[2]!, status: "EXAMINED", observations: [...list[2]!.observations, "你亲手把这一张原卡放入原托盘。没有调用原灵。"], result: "原卡实际位于原托盘，仍归墓园；等待有限报告。" };
    rerender(<SpiritmediumPanel spiritmedium={spiritmedium({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("原卡实际位于原托盘");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("没有调用原灵");
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("allows only projected zero-AP withdrawal and honours disabled, busy, blocked and read-only actions", async () => {
    const value = spiritmedium({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "lamp-spirit" }, "执行原核查", false), action({ type: "WITHDRAW", caseId: "lamp-spirit" }, "取消准备，保留原记录", true, "0行动"), action({ type: "REFLECT" }, "回看三份记录", false, "1行动")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^执行原核查/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^回看三份记录/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^取消准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "lamp-spirit" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<SpiritmediumPanel spiritmedium={value} resources={resources} {...flags} onCommand={onCommand} />);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows only projected inherited and S7 abilities with their actual mastery", () => {
    const abilities = [...CORPSECOLLECTOR_ABILITIES, ...GRAVEDIGGER_ABILITIES, ...SPIRITMEDIUM_ABILITIES].map((ability, index) => ({ ...ability, mastery: index * 7 }));
    panel(spiritmedium({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "通灵者能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 8 项能力" })).toBeTruthy();
    for (const ability of abilities) expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(within(region).getByText(/^死亡之眼 · 掌握/)).toBeTruthy();
    for (const ability of SPIRITMEDIUM_ABILITIES) expect(within(region).getByText(new RegExp(`^${ability.label} · 掌握`))).toBeTruthy();
    expect(region.textContent).toContain("当前首案未确认可借力原灵");
    expect(region.textContent).toContain("普通身体与工具行动");
    expect(screen.getByRole("region", { name: "通灵者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps actual spent originals and exposes only the projected replenishment step", async () => {
    const value = bottled();
    value.bottles.forEach((bottle) => { bottle.status = "已服用 · 失败，原瓶不恢复"; });
    value.actions = [action({ type: "REQUEST_SUPPLY" }, "向原渠道请求下一批原瓶", true, "1行动")];
    const { onCommand } = panel(value);
    expect(screen.getAllByText("已服用 · 失败，原瓶不恢复")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /查看并准备服用|领取补给/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^向原渠道请求/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REQUEST_SUPPLY" });
    expect(screen.getAllByText("已服用 · 失败，原瓶不恢复")).toHaveLength(3);
  });

  it("renders actual S7 partial answers and paper movement only after real projected outcomes", async () => {
    const raw = createSliceRun("spiritmedium-real-projection", sliceDefaultCreationSelection, "real-spirit-records");
    raw.week = 30;
    raw.activeEvent = null;
    raw.corpsecollector.discovered = true;
    raw.corpsecollector.guidanceKnown = true;
    raw.gravedigger.guidanceKnown = true;
    raw.gravedigger.promotionWeek = 10;
    raw.gravedigger.corpsecollectorActingAtPromotion = 100;
    raw.spiritmedium.guidanceKnown = true;
    raw.spiritmedium.promotionWeek = 22;
    raw.spiritmedium.gravediggerActingAtPromotion = 100;
    raw.progression = { pathwayId: "death", sequence: 7, promotionWeek: 5, acting: 0, mastery: Object.fromEntries([...CORPSECOLLECTOR_ABILITIES, ...GRAVEDIGGER_ABILITIES, ...SPIRITMEDIUM_ABILITIES].map((ability) => [ability.id, 14])) };
    Object.assign(raw.corpsecollector.bottles[0]!, { status: "CONSUMED", acquiredWeek: 5, consumedWeek: 5, outcome: "SUCCESS" });
    Object.assign(raw.gravedigger.bottles[0]!, { status: "CONSUMED", acquiredWeek: 10, consumedWeek: 10, outcome: "SUCCESS" });
    Object.assign(raw.spiritmedium.bottles[0]!, { status: "CONSUMED", acquiredWeek: 22, consumedWeek: 22, outcome: "SUCCESS" });
    Object.assign(raw.spiritmedium.cases["memento-question"]!, { status: "EXAMINED", method: "RITUAL", attemptWeek: 30, conclusion: "COMPLETE", mistakes: 1 });
    Object.assign(raw.spiritmedium.cases["wind-assistance"]!, { status: "PREPARED", method: "ORDINARY" });
    const original = JSON.stringify(raw);
    const value = projectSliceState(raw).spiritmedium;
    const onCommand = vi.fn();
    render(<SpiritmediumPanel spiritmedium={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "memento-question");
    const entry = value.cases.find((candidate) => candidate.id === "memento-question")!;
    for (const fact of entry.observations) expect(within(screen.getByRole("region", { name: "实际观察记录" })).getByText(fact)).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("证据不足");
    expect(screen.getByRole("heading", { name: "能力与消化 · 8 项能力" })).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通灵实践" }), "wind-assistance");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("原卡片");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    expect(raw.spiritmedium.cardLocation).toBe("TABLE");
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled();
    expect(JSON.stringify(raw)).toBe(original);
  });

  it("keeps inherited mastery and original bottle provenance in callback-free histories", () => {
    const state = fixture(7);
    state.corpsecollector.abilities = CORPSECOLLECTOR_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 9 }));
    state.gravedigger.abilities = GRAVEDIGGER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 11 }));
    state.gravedigger.bottles = [{ id: "gravedigger-potion-2", title: "掘墓人第二原瓶", source: "原器具库交接", status: "已耗尽 · 严重排异", chance: 40, command: { type: "CONSUME", bottleId: "gravedigger-potion-2", confirmed: true } }];
    render(<><SpiritmediumCorpsecollectorHistory corpsecollector={state.corpsecollector} /><GravediggerHistory gravedigger={state.gravedigger} /></>);
    for (const [name, value] of [["收尸人", state.corpsecollector], ["掘墓人", state.gravedigger]] as const) {
      const history = screen.getByRole("region", { name: `${name}时期的经历` });
      expect(within(history).queryByRole("button")).toBeNull();
      for (const ability of value.abilities) expect(history.textContent).toContain(`${ability.label} · 掌握 ${ability.mastery}`);
    }
    expect(screen.getByText("来源：原器具库交接")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("locks and retries the identical failed %s envelope without duplicate effects", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: SpiritmediumCommand = type === "CONSUME" ? { type, bottleId: "spiritmedium-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "lamp-spirit", method: "ORDINARY" }
      : type === "REPORT" ? { type, caseId: "lamp-spirit", conclusion: "COMPLETE" } : { type, caseId: "lamp-spirit" };
    const entry = action(command, `执行本次${type}`);
    const zeroAP = type === "CONSUME" || type === "WITHDRAW" || type === "RECEIVE_SUPPLY";
    const state = fixture(isLife ? 7 : 8, { spiritmedium: type === "CONSUME" ? bottled() : spiritmedium({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openSpiritmedium();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶通灵者魔药」" : new RegExp(`^${entry.label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "通灵者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("通灵者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SPIRITMEDIUM", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("allows ordinary work outside the dossier and preserves the actual preparation on return", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", preparation: "本次准备普通记录核对，原遗物仍由登记员保管。" };
    const state = fixture(7, { spiritmedium: spiritmedium({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: "lamp-spirit" }, "执行原核查")] }), actionsRemaining: 2 });
    const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, actionsRemaining: 1 }, envelope));
    await enter(api); await openSpiritmedium();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const work = screen.getByRole("button", { name: /工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(work);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await openSpiritmedium();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[0]!.preparation);
  });
});
