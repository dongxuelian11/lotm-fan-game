/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ASTROLOGER_ABILITIES, ASTROLOGER_CONSUMPTION_RISK } from "../../src/domain/astrologer/content";
import { TRICKMASTER_ABILITIES } from "../../src/domain/trickmaster/content";
import { APPRENTICE_ABILITIES } from "../../src/domain/apprentice/content";
import type { AstrologerAction, AstrologerCommand, AstrologerProjection } from "../../src/domain/astrologer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { AstrologerApprenticeHistory, TrickmasterHistory, AstrologerPanel } from "../../src/renderer/AstrologerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: AstrologerAction = {
  id: "guidance", label: "学习占星人服用指导", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = ASTROLOGER_CONSUMPTION_RISK;
function astrologer(patch: Partial<AstrologerProjection> = {}): AstrologerProjection {
  return {
    title: "占星人晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "戏法大师扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): AstrologerProjection {
  return astrologer({
    guidanceKnown: true,
    supplies: "完整配方待核；新渠道三瓶独立成品，2010便士或完成4次劳动抵1800便士后付210便士；指导240便士。",
    actions: ["astrologer-potion-1", "astrologer-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "astrologer-potion-1", title: "第一瓶占星人魔药", source: "观测器具档案交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "astrologer-potion-1", confirmed: true } },
      { id: "astrologer-potion-2", title: "第二瓶占星人魔药", source: "观测器具档案交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "astrologer-potion-2", confirmed: true } },
      { id: "astrologer-potion-3", title: "第三瓶占星人魔药", source: "观测器具档案交接的第三原瓶", status: "导师保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "astrologer-potion-3", confirmed: true } },
    ],
  });
}
function cases(): AstrologerProjection["cases"] {
  return ["portrait-pair", "short-route", "willing-probe"].map((id, index) => ({
    id, title: `生活实践${index + 1}`, story: `原现场对象与范围${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: AstrologerCommand, label = "观察本处现场", enabled = true, cost = "1行动 · 本案公开成本"): AstrologerAction {
  return {
    id: JSON.stringify(command), label, cost, enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: AstrologerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AstrologerPanel astrologer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("astrologer-renderer-run", sliceDefaultCreationSelection, "astrologer-renderer-seed");
  raw.week = 30;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    apprentice: { ...state.apprentice, discovered: sequence !== null, promoted: sequence !== null, acting: 100, actions: [] },
    trickmaster: { ...state.trickmaster, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7, acting: 100, actions: [] },
    astrologer: astrologer({
      promoted: sequence === 7, title: sequence === 7 ? "占星人 · 序列7" : "占星人晋升",
      actions: sequence === 7 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "door", sequence,
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
async function openAstrologer() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Astrologer sequence seven dossier", () => {
  it("keeps eleven ordinary routes and hides S7 until Door S8", async () => {
    let api = bridge(fixture(null));
    await enter(api); await openAstrologer();
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(22);
    expect(screen.getByRole("button", { name: "学徒之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /戏法大师|占星人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
    cleanup();
    api = bridge(fixture(9));
    await enter(api); await openAstrologer();
    expect(screen.getByRole("button", { name: "戏法大师晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /占星人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults Door S8 to the S7 candidate while preserving current S8 growth", async () => {
    const api = bridge(fixture(8));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await openAstrologer();
    expect(screen.getByRole("button", { name: "占星人晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "占星人成长下一步" }).textContent).toContain("戏法大师消化并度过八个完整序列8周");
    await userEvent.click(screen.getByRole("button", { name: "戏法大师成长" }));
    expect(screen.getByRole("region", { name: "戏法大师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "占星人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S7 and preserves both original lower histories without callbacks", async () => {
    const state = fixture(7);
    state.seer.discovered = true;
    state.apprentice.cases = [{ id: "locked-office", title: "原档案室通行", story: "原门与委托人均在原处", observations: ["原薄门符合通行范围"], preparation: "先前本人开门准备", result: "本人已返回并交接有限报告", status: "RESOLVED" }];
    state.apprentice.actions = [{ id: "stale-nine", label: "不得重做的学徒行动", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "locked-office" } }];
    state.trickmaster.cases = [{ id: "stage-signal", title: "原舞台信号", story: "原手铃仍留原台边", observations: ["已核对现场原手铃"], preparation: "先前普通手铃准备", result: "原手铃已实际敲响，没有冒充戏法", status: "RESOLVED" }];
    state.trickmaster.actions = [{ id: "stale-eight", label: "不得重做的戏法大师行动", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "stage-signal" } }];
    const original = JSON.stringify([state.apprentice, state.trickmaster]);
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`占星人 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("占星人 · 序列7 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openAstrologer();
    expect(screen.getByRole("button", { name: "占星人成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    for (const [name, texts] of [["学徒", ["原薄门符合通行范围", "先前本人开门准备", "本人已返回并交接有限报告"]], ["戏法大师", ["已核对现场原手铃", "先前普通手铃准备", "原手铃已实际敲响，没有冒充戏法"]]] as const) {
      await userEvent.click(screen.getByRole("button", { name: `${name}经历` }));
      const history = screen.getByRole("region", { name: `${name}时期的经历` });
      for (const text of texts) expect(within(history).getByText(text)).toBeTruthy();
      expect(history.textContent).toContain("你已晋升占星人");
      expect(within(history).queryByRole("button")).toBeNull();
      expect(screen.queryByText(/不得重做/)).toBeNull();
    }
    expect(JSON.stringify([state.apprentice, state.trickmaster])).toBe(original);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps known other routes available as history without exposing astrologer there", async () => {
    const state = fixture(9, { progression: { pathwayId: "sun", sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.apprentice.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "太阳神官成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /占星人/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "学徒经历" }));
    expect(screen.getByText("已选择其它途径，这份学徒渠道只供回看。")).toBeTruthy();
  });

  it("shows three sourced S7 originals and keeps an unknown recipe entirely absent", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应渲染的未知原料", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    const recipe = screen.getByRole("region", { name: "占星人成品渠道与配方边界" });
    expect(recipe.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(within(recipe).getByText("占星人的当前渠道只提供成品魔药，不提供完整配方；不展示原料或用量，也不开放调配。本阶段使用有独立来源记录的成品原瓶；渠道条件、场景与数值以当前公开记录为准。")).toBeTruthy();
    expect(recipe.textContent).not.toContain("属于本作游戏设定");
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
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶占星人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("astrologer-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：观测器具档案交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "占星人服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶占星人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "astrologer-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶占星人魔药的服用确认" })).toBeTruthy();
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates a stale bottle confirmation when %s", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<AstrologerPanel astrologer={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses current projected eligibility inside an already-open confirmation", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<AstrologerPanel astrologer={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "需要先恢复身心。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶占星人魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("需要先恢复身心。")).toBeTruthy();
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not recalculate maturity, cash or labour costs from renderer resources", () => {
    const value = bottled();
    const reason = "戏法大师消化尚未达100，晋升后尚未满8整周。";
    const actions: AstrologerAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "astrologer-potion-3" }, "取得导师原瓶", false, "2010便士，或实际劳动4/4后210便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 240便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("2010便士，或实际劳动4/4后210便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 240便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("allows only projected zero-AP withdrawal and honours disabled, busy, blocked and read-only actions", async () => {
    const value = astrologer({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "portrait-pair" }, "执行原核查", false), action({ type: "WITHDRAW", caseId: "portrait-pair" }, "取消准备，保留原记录", true, "0行动"), action({ type: "REFLECT" }, "回看三份记录", false, "1行动")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^执行原核查/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^回看三份记录/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^取消准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "portrait-pair" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<AstrologerPanel astrologer={value} resources={resources} {...flags} onCommand={onCommand} />);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
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

  it("keeps inherited mastery and original bottle provenance in callback-free histories", () => {
    const state = fixture(7);
    state.apprentice.abilities = APPRENTICE_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 9 }));
    state.trickmaster.abilities = TRICKMASTER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 11 }));
    state.trickmaster.bottles = [{ id: "trickmaster-potion-2", title: "戏法大师第二原瓶", source: "原器具库交接", status: "已耗尽 · 严重排异", chance: 40, command: { type: "CONSUME", bottleId: "trickmaster-potion-2", confirmed: true } }];
    render(<><AstrologerApprenticeHistory apprentice={state.apprentice} /><TrickmasterHistory trickmaster={state.trickmaster} /></>);
    for (const [name, value] of [["学徒", state.apprentice], ["戏法大师", state.trickmaster]] as const) {
      const history = screen.getByRole("region", { name: `${name}时期的经历` });
      expect(within(history).queryByRole("button")).toBeNull();
      for (const ability of value.abilities) expect(history.textContent).toContain(`${ability.label} · 掌握 ${ability.mastery}`);
    }
    expect(screen.getByText("来源：原器具库交接")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
  });

  it("allows ordinary work outside the dossier and preserves the actual preparation on return", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", preparation: "本次准备普通画像对照，原画像仍由委托人保管。" };
    const state = fixture(7, { astrologer: astrologer({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: "portrait-pair" }, "执行原核查")] }), actionsRemaining: 2 });
    const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, actionsRemaining: 1 }, envelope));
    await enter(api); await openAstrologer();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const work = screen.getByRole("button", { name: /工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(work);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await openAstrologer();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[0]!.preparation);
  });
  it("keeps unknown identities and future events unknown while selecting a case spends nothing", async () => {
    const { onCommand } = panel(astrologer({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.getByRole("region", { name: "已知现场与占星范围" }).textContent).toContain("不能预先认定");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能据此确认真实身份、未来结局或探测结果");
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), "willing-probe");
    expect(screen.getByRole("region", { name: "当前生活实践" }).textContent).toContain("原现场对象与范围3");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents STAR and ORDINARY as equal choices and never fabricates preparation after a click", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", observations: ["两幅原画在桌上，画中人之间的对应尚未知。"] };
    const choices = [action({ type: "PREPARE", caseId: "portrait-pair", method: "STAR" }, "准备有限占星询问"), action({ type: "PREPARE", caseId: "portrait-pair", method: "ORDINARY" }, "准备普通画像对照")];
    const { onCommand } = panel(astrologer({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "占星人成长下一步" });
    expect(summary.textContent).toContain("选择有限占星或普通方法");
    for (const entry of choices) {
      expect(summary.textContent).not.toContain(entry.label);
      expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    }
    const boundaries = screen.getByRole("region", { name: "占星、对应关系与干扰边界" });
    expect(boundaries.textContent).toContain("每次消耗3灵性，普通核验不消耗灵性");
    expect(boundaries.textContent).toContain("对应关系不等于揭露真实身份");
    expect(boundaries.textContent).toContain("干扰成功不保证对方探测失败");
    expect(boundaries.textContent).toContain("序列6的记录法术尚未开放");
    await userEvent.click(screen.getByRole("button", { name: /^准备普通画像对照/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
  });

  it("never creates a missing supernatural action, report or hidden target", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "OBSERVED", observations: ["本次公开投影仅允许普通对照。"] };
    const ordinary = action({ type: "PREPARE", caseId: "willing-probe", method: "ORDINARY" }, "准备普通基线");
    const { onCommand } = panel(astrologer({ promoted: true, cases: list, actions: [ordinary] }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /施加|干扰|复制|报告|记录法术/ })).toBeNull();
    expect(screen.queryByText(/未解锁选项|隐藏选项/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^准备普通基线/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it.each([
    ["portrait-pair", "核实两幅原画的对应，仍未获知其它身份秘密。"],
    ["short-route", "已核对本次路况，沿已有普通路投递；未来安全仍未知。"],
    ["willing-probe", "本次干扰已施加。梅芙成功线34%，独立原骰23，结果成功；实际消耗她自己1灵性，原卡内容仍未公开。"],
  ])("shows the actual %s result only after a committed projection", async (id, result) => {
    const list = cases();
    const index = list.findIndex((entry) => entry.id === id);
    list[index] = { ...list[index]!, status: "PREPARED", observations: ["仅已观察本次原对象与许可范围。"], preparation: "已准备本次有限方法，尚未执行。" };
    const value = astrologer({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: id }, "执行本次方法")] });
    const { rerender, onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), id);
    await userEvent.click(screen.getByRole("button", { name: /^执行本次方法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PERFORM", caseId: id });
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).not.toContain("已准备");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚未执行");
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
    expect(screen.queryByText(/独立原骰/)).toBeNull();
    list[index] = { ...list[index]!, status: "RESOLVED", preparation: null, result };
    rerender(<AstrologerPanel astrologer={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际执行结果记录" }).textContent).toBe(`实际执行结果记录${result}`);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).not.toContain(result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("preserves a failed preparation attempt without claiming the independent probe occurred", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "PREPARED", preparation: "双方同意，准备干扰后由梅芙独立测试。" };
    const { rerender, onCommand } = panel(astrologer({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), "willing-probe");
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
    list[2] = { ...list[2]!, status: "OBSERVED", preparation: null, result: "本次干扰未形成可靠结果；玩家3灵性已消耗，梅芙尚未测试，下周可重试。" };
    rerender(<AstrologerPanel astrologer={astrologer({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const result = screen.getByRole("region", { name: "实际执行结果记录" });
    expect(result.textContent).toContain("梅芙尚未测试");
    expect(result.textContent).not.toMatch(/原骰|梅芙.*成功|梅芙.*失败/);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the projected inherited abilities plus two S7 mastery groups without adding recording", () => {
    const abilities = [...APPRENTICE_ABILITIES, ...TRICKMASTER_ABILITIES, ...ASTROLOGER_ABILITIES].map((ability, index) => ({ ...ability, mastery: 9 + index * 7 }));
    panel(astrologer({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "占星人能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 4 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(within(region).getByText(ability.description)).toBeTruthy();
    }
    expect(region.querySelectorAll("details")).toHaveLength(4);
    expect(screen.getByRole("region", { name: "占星人成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders real public case projections without accessing private probe state or pre-revealing identity", async () => {
    const raw = createSliceRun("astrologer-projection-check", sliceDefaultCreationSelection, "renderer-public-probe");
    raw.week = 30;
    raw.activeEvent = null;
    raw.progression = { pathwayId: "door", sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 };
    raw.astrologer.guidanceKnown = true;
    raw.astrologer.promotionWeek = 22;
    raw.astrologer.trickmasterActingAtPromotion = 100;
    Object.assign(raw.astrologer.cases["willing-probe"]!, { status: "PREPARED", method: "STAR" });
    const value = projectSliceState(raw).astrologer;
    const original = JSON.stringify(raw);
    const { rerender, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "当前生活实践" }).textContent).not.toContain("海蒂不同年份");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), "willing-probe");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("梅芙");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("独立");
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
    expect(screen.queryByText(/原骰/)).toBeNull();
    expect(JSON.stringify(raw)).toBe(original);
    Object.assign(raw.astrologer.cases["willing-probe"]!, { status: "RESOLVED", attemptWeek: 30, outcome: "TESTED" });
    raw.astrologer.probe = { spirituality: 5, roll: 23, chance: 34, tier: "SUCCESS", interferenceApplied: true };
    const committed = projectSliceState(raw).astrologer;
    const projectedResult = committed.cases.find((entry) => entry.id === "willing-probe")!.result!;
    rerender(<AstrologerPanel astrologer={committed} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际执行结果记录" }).textContent).toContain(projectedResult);
    expect(projectedResult).toContain("34%");
    expect(projectedResult).toContain("23");
    expect(projectedResult).toContain("5灵性");
    expect(screen.queryByText(/测试卡.*真实内容是/)).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "CONSUME", "OBSERVE", "PREPARE_STAR", "PREPARE_ORDINARY", "PERFORM", "WITHDRAW", "REFLECT"] as const)("locks and retries the identical failed %s envelope without speculative effects", async (type) => {
    const command: AstrologerCommand = type === "CONSUME" ? { type, bottleId: "astrologer-potion-2", confirmed: true }
      : type === "REFLECT" || type === "LEARN_GUIDANCE" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "POTION_WORK" || type === "BUY_POTION" ? { type, bottleId: "astrologer-potion-2" }
      : type === "PREPARE_STAR" || type === "PREPARE_ORDINARY" ? { type: "PREPARE", caseId: "willing-probe", method: type === "PREPARE_STAR" ? "STAR" : "ORDINARY" }
      : { type, caseId: "willing-probe" };
    const entry = action(command, `执行本次${type}`);
    const isLife = "caseId" in command || type === "REFLECT";
    const zeroAP = type === "CONSUME" || type === "WITHDRAW" || type === "RECEIVE_SUPPLY";
    const state = fixture(isLife ? 7 : 8, { astrologer: type === "CONSUME" ? bottled() : astrologer({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openAstrologer();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶占星人魔药」" : new RegExp(`^${entry.label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "占星人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("占星人模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行结果记录" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "ASTROLOGER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

});
