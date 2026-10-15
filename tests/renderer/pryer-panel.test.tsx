/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { PRYER_ABILITIES, PRYER_CONSUMPTION_RISK } from "../../src/domain/pryer/content";
import type { PryerAction, PryerCommand, PryerProjection } from "../../src/domain/pryer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { PryerHistory, PryerPanel } from "../../src/renderer/PryerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: PryerCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): PryerAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访抄录室指导者莉奈·安瑟");
function pryer(patch: Partial<PryerProjection> = {}): PryerProjection {
  return {
    title: "窥秘人之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: PRYER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): PryerProjection {
  return pryer({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；两次实际劳动后60便士，指导120便士。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["pryer-potion-1", "pryer-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "pryer-potion-1", title: "第一瓶窥秘人魔药", source: "莉奈·安瑟独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "pryer-potion-1", confirmed: true } },
      { id: "pryer-potion-2", title: "第二瓶窥秘人魔药", source: "莉奈·安瑟独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "pryer-potion-2", confirmed: true } },
      { id: "pryer-potion-3", title: "第三瓶窥秘人魔药", source: "莉奈·安瑟独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "pryer-potion-3", confirmed: true } },
    ],
  });
}
function cases(): PryerProjection["cases"] {
  return [
    { id: "margin-copy", title: "缺了一行的抄本", story: "原目录缺了一行，不能补成已经证实的来历。", observations: [], preparation: null, result: null, status: "AVAILABLE", readingOpen: "没有尚待结束的原页阅读", overclaims: 0 },
    { id: "aura-lantern", title: "灯旁的有限迹象", story: "本人同意这一次有限观察，未知的身体情况仍未知。", observations: [], preparation: null, result: null, status: "AVAILABLE", readingOpen: "没有尚待结束的原页阅读", overclaims: 0 },
    { id: "prepared-ritual", title: "没有答复的请求", story: "核对原器具与出处，准备不代表一定得到答复。", observations: [], preparation: null, result: null, status: "AVAILABLE", readingOpen: "没有尚待结束的原页阅读", overclaims: 0 },
    { id: "intrusive-page", title: "来源不明的添注", story: "未知添注不能视为可信的复活教导。", observations: [], preparation: null, result: null, status: "AVAILABLE", readingOpen: "没有尚待结束的原页阅读", overclaims: 0 },
  ];
}
function reading(failed = false): PryerProjection {
  return pryer({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "intrusive-page" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", readingOpen: "原页仍打开：先实际合页",
      result: failed ? "此前未成，不能补出未知信息。" : "片段已记录，来源仍未核实。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "intrusive-page" }, "合上原页，结束这次阅读", true, "0行动 · 不抹掉未知风险")],
  });
}
function panel(value: PryerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PryerPanel pryer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("pryer-renderer-run", sliceDefaultCreationSelection, "pryer-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    pryer: pryer({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "窥秘人 · 序列9" : "窥秘人之路",
      actions: promoted ? [] : [discover], abilities: promoted ? PRYER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "hermit" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openPryer() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^窥秘人(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Pryer sequence-nine public knowledge dossier", () => {
  it("keeps fifteen routes in the explicit chooser and remembers the ordinary selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("button", { name: "窥秘人之路" })).toBeNull();
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openPryer();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "窥秘人之路" }).textContent).toContain("有限灵视");
    expect(screen.getByRole("region", { name: "窥秘人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /格斗学者|巫师|神秘再现|知识灌输/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "窥秘人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("selects the promoted route from the dashboard task button and shows only bounded S9 records", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("窥秘人 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看窥秘人成长" }));
    const abilities = screen.getByRole("region", { name: "窥秘人能力与消化" });
    expect(abilities.textContent).toContain("3 项训练记录");
    for (const ability of PRYER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /身体变化|接受女性身体|复活|穿墙|神秘再现/ })).toBeNull();
  });

  it("preserves independent bottle sources and supply terms without displaying an unverified recipe", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "窥秘人成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms the exact second original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶窥秘人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("pryer-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "窥秘人服用风险与四档结果" }).textContent).toContain(PRYER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶窥秘人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "pryer-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<PryerPanel pryer={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility rather than deriving readiness from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<PryerPanel pryer={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶窥秘人魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not invent knowledge or switch the chosen case when public actions change", async () => {
    const value = pryer({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "aura-lantern");
    rerender(<PryerPanel pryer={{ ...value, actions: [action({ type: "OBSERVE", caseId: "margin-copy" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("aura-lantern");
    expect(screen.getByRole("region", { name: "当前窥秘人实践" }).textContent).toContain("本人同意这一次");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches the two exact preparation methods without optimistic knowledge or preparation", async () => {
    const choices = [action({ type: "PREPARE", caseId: "prepared-ritual", method: "MYSTIC" }, "准备有限仪式"), action({ type: "PREPARE", caseId: "prepared-ritual", method: "ORDINARY" }, "准备普通核对")];
    const { onCommand } = panel(pryer({ promoted: true, cases: cases(), actions: choices }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "prepared-ritual");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
  });

  it("passes both public report claims unchanged and preserves a later correction with its wrong-history count", async () => {
    const limited = action({ type: "REPORT", caseId: "margin-copy", claim: "LIMITED" }, "记录有限事实，保留未知");
    const complete = action({ type: "REPORT", caseId: "margin-copy", claim: "COMPLETE" }, "声称已经完全证明");
    const value = pryer({ promoted: true, cases: cases().map((entry) => entry.id === "margin-copy" ? { ...entry, status: "EXAMINED", result: "缺行仍然缺失。" } : entry), actions: [limited, complete] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^声称已经完全证明/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^声称已经完全证明/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(complete.command);
    expect(screen.getByText("过度断言记录：0")).toBeTruthy();
    const wrong = { ...value, cases: value.cases.map((entry) => entry.id === "margin-copy" ? { ...entry, overclaims: 1 } : entry), actions: [{ ...limited, label: "更正为有限结论，保留未知" }, complete] };
    rerender(<PryerPanel pryer={wrong} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("过度断言记录：1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^更正为有限结论/ }));
    expect(onCommand.mock.calls[1]![0]).toEqual(limited.command);
    rerender(<PryerPanel pryer={{ ...wrong, actions: [], acting: 20, cases: wrong.cases.map((entry) => entry.id === "margin-copy" ? { ...entry, status: "RESOLVED", result: "已更正为有限事实，原错误记录仍保留。" } : entry) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("过度断言记录：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际执行与报告记录" }).textContent).toContain("原错误记录仍保留");
  });

  it.each([false, true])("forces the actual open reading after a failed check=%s, with zero-resource CLOSE", async (failed) => {
    const { onCommand, rerender } = panel(pryer({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "aura-lantern");
    const value = reading(failed);
    rerender(<PryerPanel pryer={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("intrusive-page"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本次阅读：原页仍打开：先实际合页")).toBeTruthy();
    expect(screen.getByRole("region", { name: "窥秘人成长下一步" }).textContent).toContain("不会阻断隐匿贤者");
    const close = screen.getByRole("button", { name: /^合上原页/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "intrusive-page" });
    expect(screen.getByText("本次阅读：原页仍打开：先实际合页")).toBeTruthy();
    rerender(<PryerPanel pryer={{ ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => ({ ...entry, readingOpen: "没有尚待结束的原页阅读" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(selector.value).toBe("intrusive-page"); expect(selector.disabled).toBe(false);
    expect(screen.getByText("本次阅读：没有尚待结束的原页阅读")).toBeTruthy();
  });

  it("uses public localized reading text verbatim, including an unfamiliar label", () => {
    const list = cases(); list[0] = { ...list[0]!, readingOpen: "原册已交回桌面，等待导师核对", overclaims: 2 };
    panel(pryer({ promoted: true, cases: list, actions: [] }));
    expect(screen.getByText("本次阅读：原册已交回桌面，等待导师核对")).toBeTruthy();
    expect(screen.getByText("过度断言记录：2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /合页/ })).toBeNull();
  });

  it("shows only selected case actions and authoritative blocked reasons", async () => {
    const entries = [action({ type: "OBSERVE", caseId: "margin-copy" }, "观察原抄件"), action({ type: "PREPARE", caseId: "aura-lantern", method: "MYSTIC" }, "准备有限灵视", false)];
    entries[1]!.reason = "先确认本人同意与当前现场。";
    const { onCommand } = panel(pryer({ promoted: true, cases: cases(), actions: entries }));
    expect(screen.getByRole("button", { name: /^观察原抄件/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^准备有限灵视/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "aura-lantern");
    const button = screen.getByRole("button", { name: /^准备有限灵视/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/先确认本人同意与当前现场/).length).toBeGreaterThan(0);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the discovered channel read-only after choosing another route", async () => {
    const state = fixture(false, { pryer: bottled(), progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } });
    const api = bridge(state); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "窥秘人经历" }));
    const history = within(screen.getByRole("region", { name: "窥秘人渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.getByText("来源：莉奈·安瑟独立留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains public reading, incorrect claims and sources in callback-free history", () => {
    render(<PryerHistory pryer={{ ...bottled(), cases: cases().map((entry) => ({ ...entry, overclaims: 1, result: "原错误报告仍保留。" })) }} />);
    expect(screen.getAllByText("原错误报告仍保留。")).toHaveLength(4);
    expect(screen.getAllByText(/过度断言记录：1/)).toHaveLength(4);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "CLOSE", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: PryerCommand = type === "CONSUME" ? { type, bottleId: "pryer-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "margin-copy", method: "MYSTIC" }
      : type === "REPORT" ? { type, caseId: "margin-copy", claim: "COMPLETE" }
      : { type, caseId: "margin-copy" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "CLOSE"].includes(type);
    const state = fixture(isLife, { pryer: type === "CONSUME" ? bottled() : pryer({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, pryer: { ...state.pryer, actions: [], bottles: state.pryer.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openPryer();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶窥秘人魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "窥秘人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("窥秘人模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "PRYER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([false, true])("reloads the actual open page at zero AP and mind after failed check=%s", async (failed) => {
    const state = fixture(true, { pryer: reading(failed), seer: { ...base.seer, discovered: true }, mind: 0, spirituality: 0, actionsRemaining: 0, canAct: false });
    const api = bridge(state); await enter(api);
    await screen.findByRole("region", { name: "窥秘人成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先合上异常书页");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /^合上原页/ }) as HTMLButtonElement).disabled).toBe(false);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains an open page on failed save, retries that exact CLOSE and unlocks only after the receipt", async () => {
    const state = fixture(true, { pryer: reading(true), actionsRemaining: 0, mind: 0, spirituality: 0 });
    const next: SliceProjection = { ...state, revision: state.revision + 1, pryer: { ...reading(true), insideCase: false,
      actions: [], cases: reading(true).cases.map((entry) => ({ ...entry, readingOpen: "没有尚待结束的原页阅读" })),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "合页尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "窥秘人成长下一步" });
    await userEvent.click(screen.getByRole("button", { name: /^合上原页/ }));
    expect(screen.getByRole("alert").textContent).toContain("合页尚未保存");
    expect(screen.getByText("本次阅读：原页仍打开：先实际合页")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^合上原页/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "PRYER", command: { type: "CLOSE", caseId: "intrusive-page" } });
    expect(screen.getByText("本次阅读：没有尚待结束的原页阅读")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("intrusive-page");
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it.each(["RETURN", "SETTLE"] as const)("preserves the older %s safety exit ahead of a simultaneous Pryer reading", async (exit) => {
    const state = fixture(true, {
      pryer: reading(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: "demoness", sequence: exit === "RETURN" ? 9 : 8, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    if (exit === "RETURN") state.assassin = { ...state.assassin, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "upper-draft", title: "上层原平台", story: "本人仍在原平台。", status: "EXAMINED", position: "上层平台", observations: [], preparation: null, result: "必须实际返回。" }],
      actions: [{ id: "legacy-return", label: "旧实践的普通楼梯返回", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }],
    };
    else state.instigator = { ...state.instigator, promoted: true, insideCase: true,
      cases: [{ id: "queue-grievance", title: "旧争执现场", story: "争执仍在升温。", status: "EXAMINED", tension: "仍在激化", observations: [], preparation: null, result: "必须实际停止挑动。" }],
      actions: [{ id: "legacy-settle", label: "旧实践的停止挑动", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "queue-grievance" } }],
    };
    const api = bridge(state);
    api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const label = exit === "RETURN" ? "旧实践的普通楼梯返回" : "旧实践的停止挑动";
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "窥秘人成长下一步" })).toBeNull();
    await userEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual(exit === "RETURN"
      ? { type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }
      : { type: "INSTIGATOR", command: { type: "SETTLE", caseId: "queue-grievance" } });
  });

});
