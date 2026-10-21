/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { APPRENTICE_ABILITIES, APPRENTICE_CONSUMPTION_RISK } from "../../src/domain/apprentice/content";
import type { ApprenticeAction, ApprenticeCommand, ApprenticeProjection } from "../../src/domain/apprentice/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ApprenticePanel } from "../../src/renderer/ApprenticePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: ApprenticeAction = {
  id: "discover", label: "拜访档案锁匠诺拉·维恩", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = APPRENTICE_CONSUMPTION_RISK;
function apprentice(patch: Partial<ApprenticeProjection> = {}): ApprenticeProjection {
  return {
    title: "学徒之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    cases: [], environment: "", insideCaseId: null, ...patch,
  };
}
function bottled(): ApprenticeProjection {
  return apprentice({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核；三瓶独立成品各660便士，完成两次劳动抵600便士后付60便士，指导120便士。供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["apprentice-potion-1", "apprentice-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "apprentice-potion-1", title: "第一瓶学徒魔药", source: "诺拉·维恩留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "apprentice-potion-1", confirmed: true } },
      { id: "apprentice-potion-2", title: "第二瓶学徒魔药", source: "诺拉·维恩留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "apprentice-potion-2", confirmed: true } },
      { id: "apprentice-potion-3", title: "第三瓶学徒魔药", source: "诺拉·维恩留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "apprentice-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: ApprenticeProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ApprenticePanel apprentice={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("apprentice-renderer-run", sliceDefaultCreationSelection, "apprentice-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    apprentice: apprentice({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "学徒 · 序列9" : "学徒之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? APPRENTICE_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "door" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(APPRENTICE_ABILITIES.map((ability) => [ability.id, 0])) : {},
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
async function openApprentice() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^学徒(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function cases(): ApprenticeProjection["cases"] {
  return [
    ["locked-office", "档案室上锁的原门", "委托人等在外侧，原门和钥匙路线待观察。"],
    ["thick-store", "厚墙仓库的普通入口", "仓库的原障碍与已知普通入口待观察。"],
    ["waiting-courtyard", "仍在外侧等候的人", "同伴在原庭院等候，通行方法不能替他决定位置。"],
  ].map(([id, title, story]) => ({ id: id!, title: title!, story: story!, observations: [], preparation: null, result: null, status: "AVAILABLE" }));
}
function action(command: ApprenticeCommand, label = "观察原门与退路", enabled = true, cost = "1行动 · 本次公开成本"): ApprenticeAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}

describe("Apprentice sequence nine dossier", () => {
  it("adds the eleventh route only inside the explicit growth selector and keeps S8 absent", async () => {
    const api = bridge(fixture());
    await enter(api);
    expect(screen.queryByRole("button", { name: "学徒之路" })).toBeNull();
    await openApprentice();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路", "水手之路", "歌颂者之路", "收尸人之路", "学徒之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(choices.getByRole("button", { name: "学徒之路" }).textContent).toContain("单人开门与普通退路");
    expect(screen.getByRole("region", { name: "学徒成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /戏法大师|占星人|漫游者|记录官/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "学徒成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows three distinct original bottles while leaving the complete formula unverified", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不得展示的未知材料", quantity: 9, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    const recipe = screen.getByRole("region", { name: "学徒成品渠道与配方边界" });
    expect(recipe.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(within(recipe).getByText("当前渠道只提供成品魔药，不提供完整配方。本阶段由诺拉·维恩提供有独立来源记录的成品原瓶，不提供调配；渠道条件、场景与数值以当前公开记录为准。")).toBeTruthy();
    expect(recipe.textContent).not.toContain("属于本作游戏设定");
    expect(recipe.textContent).toContain("诺拉·维恩");
    expect(recipe.textContent).toContain("有独立来源记录的成品原瓶，不提供调配");
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不得展示的未知材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus, and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶学徒魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("apprentice-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：诺拉·维恩留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "学徒服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶学徒魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "apprentice-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<ApprenticePanel apprentice={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("honours updated bottle eligibility without inventing a replacement cost or maturity", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<ApprenticePanel apprentice={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "原瓶仍在，但需要先恢复身心。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶学徒魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("原瓶仍在，但需要先恢复身心。")).toBeTruthy();
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders projected cash, labour, guidance and availability without local eligibility calculations", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions: ApprenticeAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "apprentice-potion-3" }, "取得第三原瓶", false, "660便士，或实际劳动2/2后60便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 120便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 120便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得第三原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps answers, position and original door state unknown before actual performance", async () => {
    const { onCommand } = panel(apprentice({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.getByRole("region", { name: "当前位置与已知退路" }).textContent).toContain("不能预先认定已经通过或打开原门");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("通行结果仍未知");
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通行实践" }), "waiting-courtyard");
    expect(screen.getByRole("region", { name: "当前通行实践" }).textContent).toContain("同伴在原庭院等候");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents DOOR and ORDINARY as public alternatives without optimistic preparation or passage", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", observations: ["已知原门适用，钥匙由登记员保管。"] };
    const choices = [action({ type: "PREPARE", caseId: "locked-office", method: "DOOR" }, "准备本人开门", true, "1行动 · 通行时另耗2灵性"), action({ type: "PREPARE", caseId: "locked-office", method: "ORDINARY" }, "准备普通钥匙路线", true, "1行动 · 不耗灵性")];
    const { onCommand } = panel(apprentice({ promoted: true, cases: list, actions: choices }));
    expect(screen.getByRole("region", { name: "学徒成长下一步" }).textContent).toContain("选择本人开门或已知普通路线");
    for (const entry of choices) expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通钥匙路线/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
  });

  it("leaves DOOR unavailable at the thick store while preserving the known ordinary route", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "OBSERVED", observations: ["这处原障碍不适用本次开门，侧门钥匙路线已知。"] };
    const door = { ...action({ type: "PREPARE", caseId: "thick-store", method: "DOOR" }, "准备本人开门", false), reason: "本处厚障碍不适用；不构成通用厚度上限。" };
    const ordinary = action({ type: "PREPARE", caseId: "thick-store", method: "ORDINARY" }, "准备已知侧门路线");
    const { onCommand } = panel(apprentice({ promoted: true, cases: list, actions: [door, ordinary] }));
    expect((screen.getByRole("button", { name: /^准备本人开门/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(door.reason)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^准备本人开门/ }));
    await userEvent.click(screen.getByRole("button", { name: /^准备已知侧门路线/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
  });

  it("does not claim entry, inner unlatching or companion movement after PERFORM until projection changes", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "PREPARED", observations: ["同伴仍在外庭院。"], preparation: "本人开门已准备，尚未通过原门。" };
    const perform = action({ type: "PERFORM", caseId: "waiting-courtyard" }, "实际本人通行", true, "1行动 · 2灵性");
    const before = apprentice({ promoted: true, cases: list, actions: [perform], environment: "你仍在外侧；原门未解闩；同伴仍在外庭院。" });
    const { onCommand, rerender } = panel(before);
    await userEvent.click(screen.getByRole("button", { name: /^实际本人通行/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.getByRole("region", { name: "当前位置与已知退路" }).textContent).toContain(before.environment);
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
    list[2] = { ...list[2]!, status: "EXAMINED", preparation: null, result: "本人已到内侧，实际从内侧解开原门闩。同伴仍在原外庭院，没有随本人穿越。" };
    rerender(<ApprenticePanel apprentice={apprentice({ promoted: true, cases: list, actions: [action({ type: "RETURN", caseId: "waiting-courtyard" }, "沿原普通门返回", true, "0行动")], environment: "你在内侧，原普通门已实际解闩；同伴仍在外庭院。" })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际通行与报告记录" }).textContent).toContain(list[2]!.result);
    expect(screen.getByRole("region", { name: "当前位置与已知退路" }).textContent).toContain("同伴仍在外庭院");
    expect(screen.queryByRole("button", { name: /携带同伴|一起传送|远距离传送/ })).toBeNull();
  });

  it("sends the projected zero-AP ordinary RETURN and leaves reporting disabled while still inside", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "EXAMINED", result: "本人已到内侧，原门已从内侧实际解闩。" };
    const returning = action({ type: "RETURN", caseId: "locked-office" }, "沿原普通门返回外侧", true, "0行动 · 不耗灵性");
    const report = { ...action({ type: "REPORT", caseId: "locked-office", conclusion: "LIMITED" }, "在外侧报告实际通行", false), reason: "必须先返回外侧。" };
    const before = apprentice({ promoted: true, cases: list, actions: [returning, report], environment: "你在内侧；已解闩的原门是普通退路。" });
    const { onCommand } = panel(before);
    expect(screen.getByRole("region", { name: "学徒成长下一步" }).textContent).toContain("普通门返回外侧");
    expect((screen.getByRole("button", { name: /^在外侧报告/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^沿原普通门返回/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(returning.command);
    expect(screen.getByRole("region", { name: "当前位置与已知退路" }).textContent).toContain(before.environment);
    expect(screen.getByRole("region", { name: "实际通行与报告记录" }).textContent).toContain(list[0]!.result);
  });

  it("preserves the original returned record and correction instead of manufacturing a complete answer", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "EXAMINED", observations: ["原门适用；不能推及所有障碍。"], result: "已沿原普通门回到外侧。此前绝对安全说法证据不足，原错误保留。" };
    const report = action({ type: "REPORT", caseId: "locked-office", conclusion: "LIMITED" }, "报告实际通行与未知");
    const { onCommand, rerender } = panel(apprentice({ promoted: true, cases: list, actions: [report], environment: "你已实际返回外侧。" }));
    await userEvent.click(screen.getByRole("button", { name: /^报告实际通行与未知/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command);
    expect(screen.getByRole("region", { name: "实际通行与报告记录" }).textContent).toContain("原错误保留");
    list[0] = { ...list[0]!, status: "RESOLVED", result: "已交回本次有限报告。此前1次绝对安全说法已保留并更正。" };
    rerender(<ApprenticePanel apprentice={apprentice({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际通行与报告记录" }).textContent).toBe(`实际通行与报告记录${list[0]!.result}`);
    expect(screen.queryByRole("button", { name: /自动|正确答案|揭示真相/ })).toBeNull();
  });

  it("shows next-week resupply and never restores a consumed original locally", async () => {
    const value = bottled();
    value.bottles = value.bottles.map((bottle) => ({ ...bottle, status: "已服用并消耗 · 未晋升" }));
    value.supplies = "原三瓶已经消耗；已申请补货，下一周才能领取新原瓶。";
    value.actions = [{ ...action({ type: "RECEIVE_SUPPLY" }, "领取后续原瓶", false, "0行动 · 新原瓶"), reason: "需等下一周供应到达。" }];
    const { onCommand } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getAllByText("已服用并消耗 · 未晋升")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const receive = screen.getByRole("button", { name: /^领取后续原瓶/ });
    expect((receive as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(receive);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }])("locks all typed public commands for %j", (flags) => {
    const onCommand = vi.fn();
    const value = apprentice({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "locked-office" }, "实际通行"), action({ type: "WITHDRAW", caseId: "locked-office" }, "取消准备", true, "0行动"), action({ type: "REFLECT" }, "回看三份通行记录")] });
    render(<ApprenticePanel apprentice={value} resources={resources} {...flags} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only projected S9 mastery and does not invent a higher-sequence selector after digestion", () => {
    panel(apprentice({ promoted: true, acting: 100, digestion: "已消化", actions: [], abilities: APPRENTICE_ABILITIES.map((ability) => ({ ...ability, mastery: 42 })) }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 1 项能力" })).toBeTruthy();
    expect(screen.getByText("开门 · 掌握 42")).toBeTruthy();
    expect(screen.getByText("扮演进度 100 · 消化：已消化")).toBeTruthy();
    expect(screen.getByRole("region", { name: "学徒能力与消化" }).textContent).toContain("本人通过适用的原障碍");
    expect(screen.queryByRole("button", { name: /晋升|戏法大师|占星人|记录官/ })).toBeNull();
  });

  it("keeps current door S9 accessible from growth and character details alongside S8 preparation", async () => {
    const state = fixture(true, { progression: { pathwayId: "door", sequence: 9, acting: 100, mastery: { "door.s9.door-opening": 42 }, promotionWeek: 5 } });
    state.apprentice.acting = 100;
    state.seer.discovered = true;
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`学徒 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("学徒 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openApprentice();
    expect(screen.getByRole("button", { name: "学徒成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "戏法大师晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /占星人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("makes a known apprentice channel read-only after choosing another path", async () => {
    const api = bridge(fixture(false, { apprentice: bottled(), progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "学徒经历" }));
    expect(screen.getByText("已选择其它途径，这份学徒渠道只供回看。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(screen.getByText("来源：诺拉·维恩留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"], ["audience", "心理医生成长下一步"],
    ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"], ["darkness", "梦魇成长下一步"],
    ["white-tower", "守知者成长下一步"], ["tyrant", "航海家成长下一步"], ["sun", "太阳神官成长下一步"], ["death", "通灵者成长下一步"],
  ] as const)("preserves the existing %s sequence-seven default", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.apprentice.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "学徒成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "RETURN", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("locks and retries the exact failed %s envelope without optimistic effects", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: ApprenticeCommand = type === "CONSUME" ? { type, bottleId: "apprentice-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "locked-office", method: "ORDINARY" }
      : type === "REPORT" ? { type, caseId: "locked-office", conclusion: "CERTAIN" } : { type, caseId: "locked-office" };
    const entry = action(command, `执行本次${type}`);
    const zeroAP = type === "CONSUME" || type === "RETURN" || type === "WITHDRAW" || type === "RECEIVE_SUPPLY";
    const state = fixture(isLife, { apprentice: type === "CONSUME" ? bottled() : apprentice({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openApprentice();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶学徒魔药」" : new RegExp(`^${entry.label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "学徒模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("学徒模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "APPRENTICE", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("allows ordinary work outside the dossier and preserves the prepared route when reopened", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", preparation: "已选普通钥匙路线，尚未实际通行。" };
    const state = fixture(true, { apprentice: apprentice({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: "locked-office" }, "实际通行")] }), actionsRemaining: 2 });
    const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, actionsRemaining: 1 }, envelope));
    await enter(api); await openApprentice();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const work = screen.getByRole("button", { name: /工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(work);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await openApprentice();
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[0]!.preparation);
  });

  it("keeps the actual inside case selected so a previous dossier choice cannot hide RETURN", async () => {
    const list = cases();
    const { onCommand, rerender } = panel(apprentice({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择通行实践" }), "thick-store");
    list[2] = { ...list[2]!, status: "EXAMINED", result: "本人在院门内侧，原内闩已经亲手拉开；同伴仍在外侧。" };
    const returning = action({ type: "RETURN", caseId: "waiting-courtyard" }, "沿原普通门返回外侧", true, "0行动 · 不耗灵性");
    rerender(<ApprenticePanel apprentice={apprentice({ promoted: true, acting: 100, insideCaseId: "waiting-courtyard", cases: list, actions: [returning] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择通行实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("waiting-courtyard");
    expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "学徒成长下一步" }).textContent).toContain("先沿已开的原门返回");
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^沿原普通门返回/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(returning.command);
  });

  it("blocks outside services while inside, keeps REST available, and requires an explicit zero-AP return", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "EXAMINED", result: "你实际在原门内侧；原门已解闩。" };
    const returning = action({ type: "RETURN", caseId: "locked-office" }, "沿原普通门返回外侧", true, "0行动 · 不耗灵性");
    const state = fixture(true, { actionsRemaining: 1, apprentice: apprentice({ promoted: true, insideCaseId: "locked-office", cases: list, actions: [returning] }) });
    state.seer.discovered = true;
    const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, apprentice: { ...state.apprentice, insideCaseId: null, actions: [] } }, envelope));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先沿已开的原门返回");
    for (const name of [/工作，1行动/, /学习，1行动/, /调查，1行动/, /随身物品与商店/]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /休养，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "查看原门与返回" }));
    expect((screen.getByRole("button", { name: "占卜家经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^沿原普通门返回/ }));
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "APPRENTICE", command: returning.command });
    expect((screen.getByRole("button", { name: /工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps a blocking bill event accessible while inside instead of forcing a return modal", async () => {
    const event = { instanceId: "inside-bill-event", id: "BILL", title: "原账单仍需处理", body: "你仍在门内，先处理当前账单。", facts: [], choices: [{ id: "ACKNOWLEDGE", label: "处理原账单", preview: "按原账单条件结算", enabled: true }] };
    const state = fixture(true, { activeEvent: event, apprentice: apprentice({ promoted: true, insideCaseId: "locked-office", cases: cases(), actions: [] }) });
    const api = bridge(state);
    window.sliceGame = api;
    render(<SliceApp />);
    await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
    const dialog = screen.getByRole("dialog", { name: event.title });
    expect((within(dialog).getByRole("button", { name: /处理原账单/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("submits only the projected zero-AP withdrawal and leaves actual preparation unchanged until saved", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "PREPARED", preparation: "本人开门准备仍保留；尚未通过。" };
    const withdraw = action({ type: "WITHDRAW", caseId: "locked-office" }, "取消本次准备", true, "0行动");
    const { onCommand } = panel(apprentice({ promoted: true, cases: list, actions: [withdraw] }));
    await userEvent.click(screen.getByRole("button", { name: /^取消本次准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[0]!.preparation);
    expect(screen.queryByRole("region", { name: "实际通行与报告记录" })).toBeNull();
  });

  it("integrates only committed passage and return records into the existing chronicle", async () => {
    const records = [
      { id: "apprentice-passage", week: 6, title: "原门内侧的实际经过", text: "本人已实际通过原门并从内侧解闩，同伴仍在外侧。" },
      { id: "apprentice-return", week: 6, title: "沿原普通门返回", text: "本人沿已打开的原普通门回到外侧，0行动，不再施术。" },
    ];
    const api = bridge(fixture(true, { chronicle: records, lastResult: records[1]! }));
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /完整纪事/ }));
    const log = within(screen.getByRole("dialog", { name: "完整纪事" }));
    for (const record of records) expect(log.getByText(record.text)).toBeTruthy();
    expect(log.queryByText(/同伴已经穿越|带着同伴传送/)).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

});
