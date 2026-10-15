/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { MONSTER_ABILITIES, MONSTER_CONSUMPTION_RISK } from "../../src/domain/monster/content";
import type { MonsterAction, MonsterCommand, MonsterProjection } from "../../src/domain/monster/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { MonsterPanel } from "../../src/renderer/MonsterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: MonsterCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): MonsterAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访报时铺记录员艾妲·芬恩");
function monster(patch: Partial<MonsterProjection> = {}): MonsterProjection {
  return {
    title: "怪物之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可了解渠道与服药。", pollution: 3,
    risk: MONSTER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): MonsterProjection {
  return monster({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动后60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；跨周补给另行申请、领取。",
    actions: ["monster-potion-1", "monster-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "monster-potion-1", title: "第一瓶怪物魔药", source: "艾妲·芬恩独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "monster-potion-1", confirmed: true } },
      { id: "monster-potion-2", title: "第二瓶怪物魔药", source: "艾妲·芬恩独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "monster-potion-2", confirmed: true } },
      { id: "monster-potion-3", title: "第三瓶怪物魔药", source: "艾妲·芬恩独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "monster-potion-3", confirmed: true } },
    ],
  });
}
function cases(): MonsterProjection["cases"] {
  return [
    { id: "falling-sign", title: "晃动的原招牌", story: "招牌位置已知，片段和实际紧固条件仍须分别记录。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未集中观察", closes: 0, overclaims: 0 },
    { id: "wrong-shadow", title: "错位的原影子", story: "影子是否异常仍须普通核实，不能先认定其原因。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未集中观察", closes: 0, overclaims: 0 },
    { id: "quiet-door", title: "安静的原门", story: "原门没有明显异动，安静也不能证明没有危险。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未集中观察", closes: 0, overclaims: 0 },
  ];
}
function opened(): MonsterProjection {
  return monster({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "wrong-shadow" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次集中观察尚未实际结束",
      observations: ["曾记录模糊的影子片段，来源与含义未定。"],
      result: "本次普通核实失败；原片段尚未证实，观察接触仍须另行结束。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "wrong-shadow" }, "实际结束原影子的观察接触", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: MonsterProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<MonsterPanel monster={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("monster-renderer-run", sliceDefaultCreationSelection, "monster-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    monster: monster({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "怪物 · 序列9" : "怪物之路",
      actions: promoted ? [] : [discover], abilities: promoted ? MONSTER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "wheel" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openMonster() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^怪物(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Monster sequence-nine public omen dossier", () => {
  it("offers nineteen ordinary routes and remembers the explicit Monster selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openMonster();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "怪物之路" }).textContent).toContain("偶发预兆");
    expect(choices.getByRole("button", { name: "怪物之路" }).getAttribute("aria-pressed")).toBe("true");
    expect(choices.getByRole("button", { name: "占卜家之路" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "怪物成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "怪物成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current growth with fragmentary perception and no higher-sequence controls", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("怪物 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看怪物成长" }));
    const abilities = screen.getByRole("region", { name: "怪物能力与消化" });
    for (const ability of MONSTER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const boundary of ["高灵性感知", "零碎预兆", "后来普通核实", "暂定结论", "不提供序列8"]) expect(abilities.textContent).toContain(boundary);
    expect(screen.getByRole("region", { name: "怪物成长下一步" }).textContent).toContain("取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项实践与数值以当前说明为准。记录片段、普通核实与承认未知是本阶段的扮演方式，可完成本阶段消化；偶发预兆不等于确定未来。");
    expect(screen.queryByRole("button", { name: /机器人|幸运儿|幸运控制|序列8晋升/ })).toBeNull();
  });

  it("keeps four ordinary weeks as the projected discovery gate without inventing a shortcut", () => {
    const reason = "需要完成四个完整普通周，第5周起才可发现艾妲·芬恩的渠道。";
    const { onCommand } = panel(monster({ actions: [{ ...discover, enabled: false, reason }], digestion: "普通生活0/4整周。" }));
    const button = screen.getByRole("button", { name: /^拜访报时铺记录员/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(screen.getAllByText(new RegExp(reason))).not.toHaveLength(0);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /服用|跳过|直接晋升/ })).toBeNull();
  });

  it("shows three independent sources and public supply terms without unverified ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "怪物成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms only the chosen original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶怪物魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("monster-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "怪物服用风险与四档结果" }).textContent).toContain(MONSTER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶怪物魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "monster-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly", "insideCase"] as const)("invalidates a confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MonsterPanel monster={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "insideCase" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps updated bottle eligibility authoritative instead of deriving it from resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<MonsterPanel monster={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶怪物魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps selected cases and reveals no observation or result before its committed projection", async () => {
    const value = monster({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "quiet-door");
    rerender(<MonsterPanel monster={{ ...value, actions: [action({ type: "OBSERVE", caseId: "falling-sign" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("quiet-door");
    expect(screen.getByRole("region", { name: "当前怪物实践" }).textContent).toContain("安静也不能证明没有危险");
    expect(screen.queryByRole("region", { name: "片段、普通核实与暂定报告" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches only public ATTEND and ORDINARY methods while keeping fragments distinct from verification", async () => {
    const choices = (["ATTEND", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "falling-sign", method }, `准备${method}`));
    const { onCommand } = panel(monster({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    const boundaries = screen.getByRole("region", { name: "片段、核实与报告边界" });
    for (const text of ["片段记录、普通核实与暂定报告是不同的事实", "不能点选精确未来", "不保证所见真实或完整"]) expect(boundaries.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "片段、普通核实与暂定报告" })).toBeNull();
    expect(screen.queryByRole("button", { name: /结束/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "quiet-door");
    expect(screen.queryByRole("button", { name: /^准备ATTEND/ })).toBeNull();
  });

  it("preserves tentative and overcertain report commands, costs and earlier overclaim history", async () => {
    const choices = (["LIMITED", "CERTAIN"] as const).map((claim) => action({ type: "REPORT", caseId: "falling-sign", claim }, `报告${claim}`, claim === "LIMITED", "1行动 · 已公开报告成本"));
    const value = monster({ promoted: true, cases: cases().map((entry) => entry.id === "falling-sign" ? { ...entry, status: "EXAMINED", closes: 1, overclaims: 2, result: "片段记录：曾感到晃动。后来普通核实：只确认原紧固件松动。暂定结论：未证明未来必然发生。" } : entry), actions: choices });
    const { onCommand } = panel(value);
    expect(screen.getByText("过度断言记录：2")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "片段、普通核实与暂定报告" }).textContent).toContain("后来普通核实");
    const limited = screen.getByRole("button", { name: /^报告LIMITED/ });
    const certain = screen.getByRole("button", { name: /^报告CERTAIN/ });
    expect((certain as HTMLButtonElement).disabled).toBe(true); expect(limited.textContent).toContain(choices[0]!.cost);
    fireEvent.click(certain); await userEvent.click(limited);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "falling-sign", claim: "LIMITED" });
    expect(screen.getByText("过度断言记录：2")).toBeTruthy();
  });

  it("selects the actual open contact and exposes only matching CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(monster({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "quiet-door");
    const value = opened();
    rerender(<MonsterPanel monster={{ ...value, actions: [...value.actions, action({ type: "REPORT", caseId: "wrong-shadow", claim: "CERTAIN" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "wrong-shadow" }, "不能撤回代替结束"), action({ type: "REFLECT" }, "不能提前反思")] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("wrong-shadow"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本次观察接触：本次集中观察尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "怪物成长下一步" }).textContent).toContain("不另抽随机、不奖励、不治疗、不退还此前成本");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束原影子/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "wrong-shadow" });
    expect(screen.getByText("本次观察接触：本次集中观察尚未实际结束")).toBeTruthy();
  });

  it("never manufactures a missing CLOSE action from public contact prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "怪物成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a discovered Monster channel read-only after selecting another route", async () => {
    const api = bridge(fixture(false, { monster: { ...bottled(), cases: opened().cases }, progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "怪物经历" }));
    const history = within(screen.getByRole("region", { name: "怪物渠道经历" }));
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.getByText(/本次观察接触：本次集中观察尚未实际结束/)).toBeTruthy();
    expect(history.getByText("来源：艾妲·芬恩独立留存的第一原瓶")).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "CLOSE", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts or duplicate clicks", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: MonsterCommand = type === "CONSUME" ? { type, bottleId: "monster-potion-2", confirmed: true }
      : type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" || type === "REFLECT" ? { type }
      : type === "PREPARE" ? { type, caseId: "falling-sign", method: "ATTEND" }
      : type === "REPORT" ? { type, caseId: "falling-sign", claim: "CERTAIN" }
      : { type, caseId: "falling-sign" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "CLOSE"].includes(type);
    const state = fixture(isLife, { monster: type === "CONSUME" ? bottled() : monster({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, monster: { ...state.monster, actions: [], bottles: state.monster.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openMonster();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶怪物魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "怪物模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("怪物模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "片段、普通核实与暂定报告" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MONSTER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads contact at zero resources and unlocks only after the actual CLOSE receipt", async () => {
    const state = fixture(true, { monster: opened(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, monster: { ...opened(), insideCase: false,
      actions: [], cases: opened().cases.map((entry) => entry.id === "wrong-shadow" ? { ...entry, contactOpen: "本次集中观察已实际结束", closes: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "怪物成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次观察接触");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" });
    expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) {
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束原影子/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次观察接触：本次集中观察尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "MONSTER", command: { type: "CLOSE", caseId: "wrong-shadow" } });
    expect(screen.getByText("本次观察接触：本次集中观察已实际结束")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
    expect(next.cash).toBe(state.cash); expect(next.health).toBe(state.health); expect(next.mind).toBe(state.mind);
  });

  it.each(["pryer", "prisoner", "madman", "werewolf", "moon"] as const)("preserves an older %s actual exit ahead of simultaneous Monster contact", async (older) => {
    const state = fixture(true, { monster: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: older === "pryer" ? "hermit" : "chained", sequence: older === "pryer" || older === "prisoner" ? 9 : older === "madman" ? 8 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (older === "pryer") state.pryer = { ...state.pryer, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "intrusive-page", title: "原异常页", story: "尚未合页。", status: "EXAMINED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else if (older === "prisoner") state.prisoner = { ...state.prisoner, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "jammed-shutter", title: "原百叶窗", story: "原木垫块仍在手中。", status: "EXAMINED", holding: "尚未归还", returns: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-return", label, cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "jammed-shutter" } }],
    };
    else if (older === "madman") state.madman = { ...state.madman, promoted: true, insideCase: true,
      cases: [{ id: "weighted-gate", title: "原闸门", story: "尚未停止。", status: "EXAMINED", burstOpen: "尚未停止", stops: 0, burstUses: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-stop", label, cost: "0行动", enabled: true, reason: null, command: { type: "STOP", caseId: "weighted-gate" } }],
    };
    else state.werewolf = { ...state.werewolf, promoted: true, insideCase: true,
      moon: { pending: older === "moon", summary: "原月相记录", history: [] },
      cases: [{ id: "claw-mark", title: "原木", story: "尚未返回。", status: "EXAMINED", sceneOpen: "尚未返回", returns: 0, observations: [], preparation: null, result: null }],
      actions: older === "moon"
        ? [{ id: "legacy-moon", label, cost: "0行动", enabled: true, reason: null, command: { type: "HANDLE_MOON", method: "GUARDED" } }]
        : [{ id: "legacy-return", label, cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "claw-mark" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "怪物成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(older === "moon" ? "WEREWOLF" : older.toUpperCase());
  });

  it.each(["PREPARED", "EXAMINED", "RESOLVED"] as const)("does not lock ordinary life for %s records or old contact prose", async (status) => {
    const value = monster({ promoted: true, cases: cases().map((entry) => ({ ...entry, status, preparation: "旧准备仍可回看", result: "已提交的原结果", contactOpen: "旧文字说接触尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(true, { monster: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openMonster(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^实际结束原影子/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a failed original consumed and opens a different bottle with updated resources", async () => {
    const state = fixture(false, { monster: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      monster: { ...state.monster, bottles: state.monster.bottles.map((bottle) => bottle.id === "monster-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.monster.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openMonster();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶怪物魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("monster-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
