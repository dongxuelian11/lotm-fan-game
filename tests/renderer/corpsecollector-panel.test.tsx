/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CORPSECOLLECTOR_ABILITIES, CORPSECOLLECTOR_CONSUMPTION_RISK } from "../../src/domain/corpsecollector/content";
import type { CorpsecollectorAction, CorpsecollectorCommand, CorpsecollectorProjection } from "../../src/domain/corpsecollector/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { CorpsecollectorPanel } from "../../src/renderer/CorpsecollectorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: CorpsecollectorAction = {
  id: "discover", label: "拜访独立殓房登记员", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = CORPSECOLLECTOR_CONSUMPTION_RISK;
function corpsecollector(patch: Partial<CorpsecollectorProjection> = {}): CorpsecollectorProjection {
  return {
    title: "收尸人之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): CorpsecollectorProjection {
  return corpsecollector({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核；三瓶独立成品各660便士，完成两次劳动抵600便士后付60便士，指导120便士。供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["corpsecollector-potion-1", "corpsecollector-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "corpsecollector-potion-1", title: "第一瓶收尸人魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "corpsecollector-potion-1", confirmed: true } },
      { id: "corpsecollector-potion-2", title: "第二瓶收尸人魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "corpsecollector-potion-2", confirmed: true } },
      { id: "corpsecollector-potion-3", title: "第三瓶收尸人魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "corpsecollector-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: CorpsecollectorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CorpsecollectorPanel corpsecollector={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("corpsecollector-renderer-run", sliceDefaultCreationSelection, "corpsecollector-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    corpsecollector: corpsecollector({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "收尸人 · 序列9" : "收尸人之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? CORPSECOLLECTOR_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "death" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(CORPSECOLLECTOR_ABILITIES.map((ability) => [ability.id, 0])) : {},
      acting: 0, promotionWeek: promoted ? 5 : null,
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
async function openCorpsecollector() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^收尸人(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function cases(): CorpsecollectorProjection["cases"] {
  return [
    ["unclaimed-body", "编号十七，姓名待核", "成年逝者原编号等待核实，原遗物由登记员封存。"],
    ["cold-storage", "寒气没有回答的问题", "原冷藏记录与门封记等待核对，保持原隔离。"],
    ["quiet-passage", "墓园侧廊的静影", "原守墓人保管墓碑与原物，不向家属编造亡魂证词。"],
  ].map(([id, title, story]) => ({ id: id!, title: title!, story: story!, observations: [], preparation: null, result: null, status: "AVAILABLE" }));
}
function action(command: CorpsecollectorCommand, label = "核对原记录与现场", enabled = true, cost = "1行动 · 本次公开成本"): CorpsecollectorAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}

describe("Corpsecollector sequence nine dossier", () => {
  it("adds a tenth compact ordinary route, opens only its dossier, and spends nothing on navigation", async () => {
    const api = bridge(fixture());
    await enter(api);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await openCorpsecollector();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路", "水手之路", "歌颂者之路", "收尸人之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(choices.getByRole("button", { name: "收尸人之路" }).textContent).toContain("遗体照料与有限灵视");
    expect(screen.getByRole("region", { name: "收尸人成长下一步" }).textContent).toContain("尊重遗体与家属隐私");
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /掘墓人|通灵者|祈光人|太阳神官/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "收尸人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows three sourced finished originals and a quantity-free clue without inventing the full recipe", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应渲染的未知原料", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    const recipe = screen.getByRole("region", { name: "收尸人成品渠道与配方边界" });
    expect(recipe.textContent).toContain("风干的成年黑斑青蛙");
    expect(recipe.textContent).toContain("其用量与完整配方未核实");
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
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶收尸人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("corpsecollector-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "收尸人服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶收尸人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "corpsecollector-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶收尸人魔药的服用确认" })).toBeTruthy();
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates a stale bottle confirmation when %s", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<CorpsecollectorPanel corpsecollector={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses current projected eligibility inside an already-open confirmation", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<CorpsecollectorPanel corpsecollector={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "需要先恢复身心。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶收尸人魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("需要先恢复身心。")).toBeTruthy();
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not recalculate maturity, cash or labour costs from renderer resources", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions: CorpsecollectorAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "corpsecollector-potion-3" }, "取得导师原瓶", false, "660便士，或实际劳动2/2后60便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 120便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 120便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps unknown identity and causes unknown while case selection spends nothing", async () => {
    const { onCommand } = panel(corpsecollector({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.getByRole("region", { name: "已知登记处与核验范围" }).textContent).toContain("不能预先认定");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能据此确定逝者身份、死因或异常来源");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择遗体照料" }), "quiet-passage");
    expect(screen.getByRole("region", { name: "当前遗体照料" }).textContent).toContain("不向家属编造亡魂证词");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents SIGHT and ORDINARY as equal choices and never fabricates preparation after a click", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", observations: ["原编号相符，但死者身份仍待确认。"] };
    const choices = [action({ type: "PREPARE", caseId: "unclaimed-body", method: "SIGHT" }, "准备短时灵视"), action({ type: "PREPARE", caseId: "unclaimed-body", method: "ORDINARY" }, "准备普通记录核对")];
    const { onCommand } = panel(corpsecollector({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "收尸人成长下一步" });
    expect(summary.textContent).toContain("选择有限灵视或普通核验");
    for (const entry of choices) expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通记录核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
  });

  it("separates actual observations, prepared method and returned report without optimistic facts", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "PREPARED", observations: ["原温度记录只有一段下降，来源未知。"], preparation: "已选普通记录核对，原隔离仍保留。" };
    const { onCommand, rerender } = panel(corpsecollector({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择遗体照料" }), "cold-storage");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain(list[1]!.observations[0]);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).not.toContain(list[1]!.preparation);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[1]!.preparation);
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    list[1] = { ...list[1]!, status: "EXAMINED", preparation: null, result: "原核查完成，等待你选择报告。" };
    const reports = [action({ type: "REPORT", caseId: "cold-storage", conclusion: "LIMITED" }, "提交所见与未知"), action({ type: "REPORT", caseId: "cold-storage", conclusion: "CERTAIN" }, "宣称所有人进入都安全")];
    rerender(<CorpsecollectorPanel corpsecollector={corpsecollector({ promoted: true, cases: list, actions: reports })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前遗体照料" }).textContent).toContain("已核验，尚待报告");
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("等待你选择报告");
    expect(screen.queryByRole("button", { name: /自动|正确答案|揭示真相/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^宣称所有人进入都安全/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(reports[1]!.command);
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("等待你选择报告");
  });

  it("retains a mistaken definite assertion and its later correction exactly as projected", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "EXAMINED", observations: ["淡影没有提供身份或证词，不能认定无害。"], result: "此前确定说法被指出证据不足；原核查保留，可作有限报告。" };
    const correction = action({ type: "REPORT", caseId: "quiet-passage", conclusion: "LIMITED" }, "提交所见与未知，保留进一步检查");
    const { onCommand, rerender } = panel(corpsecollector({ promoted: true, cases: list, actions: [correction] }));
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("此前确定说法被指出证据不足");
    await userEvent.click(screen.getByRole("button", { name: /^提交所见与未知/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(correction.command);
    list[2] = { ...list[2]!, status: "RESOLVED", result: "已如实交回有限观察。此前1次确定说法已保留为证据不足并更正。" };
    rerender(<CorpsecollectorPanel corpsecollector={corpsecollector({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择遗体照料" }), "quiet-passage");
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toBe(`实际核验与报告记录${list[2]!.result}`);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能认定无害");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("allows only projected zero-AP withdrawal and honours disabled, busy, blocked and read-only actions", async () => {
    const value = corpsecollector({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "unclaimed-body" }, "执行原核查", false), action({ type: "WITHDRAW", caseId: "unclaimed-body" }, "取消准备，保留原记录", true, "0行动"), action({ type: "REFLECT" }, "回看三份记录", false, "1行动")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^执行原核查/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^回看三份记录/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^取消准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "unclaimed-body" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<CorpsecollectorPanel corpsecollector={value} resources={resources} {...flags} onCommand={onCommand} />);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows only the three supplied sequence-nine abilities and their actual mastery", () => {
    const abilities = CORPSECOLLECTOR_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 }));
    panel(corpsecollector({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "收尸人能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 3 项能力" })).toBeTruthy();
    for (const ability of abilities) expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(within(region).queryByText(/^死亡之眼 · 掌握/)).toBeNull();
    expect(within(region).queryByText(/^通灵问答 · 掌握/)).toBeNull();
    expect(screen.getByRole("region", { name: "收尸人成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
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

  it("keeps current corpsecollector growth reachable beside S8 and preserves another discovered channel as history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "先前已知的占卜家材料", quantity: 1, unit: "份" }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`收尸人 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("收尸人 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openCorpsecollector();
    expect(screen.getByRole("region", { name: "收尸人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("先前已知的占卜家材料");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("makes a discovered corpsecollector channel read-only after another route is selected", async () => {
    const value = bottled();
    const state = fixture(false, { corpsecollector: value, progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const api = bridge(state);
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "收尸人经历" }));
    expect(screen.getByText("已选择其它途径，这份收尸人渠道只供回看。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(screen.getByText("来源：导师留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"], ["audience", "心理医生成长下一步"],
    ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"], ["darkness", "梦魇成长下一步"],
    ["white-tower", "守知者成长下一步"], ["tyrant", "航海家成长下一步"], ["sun", "太阳神官成长下一步"],
  ] as const)("preserves the existing %s sequence-seven default", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.corpsecollector.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "收尸人成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("locks and retries the identical failed %s envelope without duplicate effects", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: CorpsecollectorCommand = type === "CONSUME" ? { type, bottleId: "corpsecollector-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "unclaimed-body", method: "ORDINARY" }
      : type === "REPORT" ? { type, caseId: "unclaimed-body", conclusion: "CERTAIN" } : { type, caseId: "unclaimed-body" };
    const entry = action(command, `执行本次${type}`);
    const zeroAP = type === "CONSUME" || type === "WITHDRAW" || type === "RECEIVE_SUPPLY";
    const state = fixture(isLife, { corpsecollector: type === "CONSUME" ? bottled() : corpsecollector({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openCorpsecollector();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶收尸人魔药」" : new RegExp(`^${entry.label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "收尸人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("收尸人模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际核验与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CORPSECOLLECTOR", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("renders actual projected mortuary facts read-only without revealing a missing identity or rewriting the source", async () => {
    const raw = createSliceRun("corpsecollector-real-projection", sliceDefaultCreationSelection, "real-records");
    raw.week = 8;
    raw.activeEvent = null;
    raw.corpsecollector.discovered = true;
    raw.corpsecollector.guidanceKnown = true;
    raw.progression = { pathwayId: "death", sequence: 9, promotionWeek: 5, acting: 0, mastery: Object.fromEntries(CORPSECOLLECTOR_ABILITIES.map((ability) => [ability.id, 14])) };
    Object.assign(raw.corpsecollector.bottles[0]!, { status: "CONSUMED", acquiredWeek: 5, consumedWeek: 5, outcome: "SUCCESS" });
    Object.assign(raw.corpsecollector.cases["unclaimed-body"]!, { status: "EXAMINED", method: "SIGHT", attemptWeek: 8, conclusion: "CERTAIN", mistakes: 1 });
    const original = JSON.stringify(raw);
    const value = projectSliceState(raw).corpsecollector;
    const onCommand = vi.fn();
    render(<CorpsecollectorPanel corpsecollector={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择遗体照料" }), "unclaimed-body");
    const observations = screen.getByRole("region", { name: "实际观察记录" });
    for (const fact of value.cases[0]!.observations) expect(within(observations).getByText(fact)).toBeTruthy();
    expect(observations.textContent).toContain("无法据此确定完整死因、身份或凶手");
    expect(screen.getByRole("region", { name: "实际核验与报告记录" }).textContent).toContain("此前确定说法被指出证据不足");
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled();
    expect(JSON.stringify(raw)).toBe(original);
  });

  it("allows ordinary work outside the dossier and preserves the actual preparation on return", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", preparation: "本次准备普通记录核对，原遗物仍由登记员保管。" };
    const state = fixture(true, { corpsecollector: corpsecollector({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: "unclaimed-body" }, "执行原核查")] }), actionsRemaining: 2 });
    const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, actionsRemaining: 1 }, envelope));
    await enter(api); await openCorpsecollector();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const work = screen.getByRole("button", { name: /工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(work);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await openCorpsecollector();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[0]!.preparation);
  });
});
