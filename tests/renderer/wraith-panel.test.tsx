/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WraithAction, WraithCommand, WraithProjection } from "../../src/domain/wraith/types";
import type { ZombieProjection } from "../../src/domain/zombie/types";
import { WraithPanel, WraithZombieHistory } from "../../src/renderer/WraithPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyPractice: WraithProjection["practice"] = { form: "HUMAN", node: "ROOM", mirror: "COVERED", host: "SELF", flag: "TABLE", note: "BLANK" };
const risk = "意志26：大成功与成功晋升；失败与灾难仍耗原瓶，原排异和污染保留。健康须高于20、精神须高于40；晋升不补满灵性。";
function action(command: WraithCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): WraithAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取怨魂成品用药指导", true, "460便士 · 1行动");
function wraith(patch: Partial<WraithProjection> = {}): WraithProjection {
  return {
    title: "怨魂晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "活尸扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: { ...emptyPractice },
    moon: { pending: false, summary: "下一场已公示月圆为第60周。", history: [] }, ...patch,
  };
}
function cases(): WraithProjection["cases"] {
  return [
    { id: "reflected-room", title: "同一双镜的有限去回", story: "原室镜与四米外原壁龛镜均在原处，原普通侧廊连通两处。" },
    { id: "willing-signal", title: "诺兰同意的一次原旗举起", story: "原成年诺兰只同意本次一次举旗，随时可以停止。" },
    { id: "honest-account", title: "同一原纸的有限记录", story: "只记录已经实际发生的结果，原失败文字保留。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): WraithProjection {
  const originals = [
    { id: "wraith-potion-1", title: "第一瓶怨魂魔药", source: "G原渠道第一瓶独立成品，导师实际准备", chance: 71 },
    { id: "wraith-potion-2", title: "第二瓶怨魂魔药", source: "G原渠道第二瓶独立成品，独立采购记录", chance: 43 },
    { id: "wraith-potion-3", title: "第三瓶怨魂魔药", source: "G原渠道第三瓶独立成品，独立封装记录", chance: 61 },
  ];
  return wraith({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶4800便士或五步劳务后600便士。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(caseId = "reflected-room", patch: Partial<WraithProjection> = {}): WraithProjection {
  const practice: WraithProjection["practice"] = caseId === "reflected-room"
    ? { ...emptyPractice, form: "WRAITH", node: "ALCOVE", mirror: "OPEN" }
    : caseId === "willing-signal" ? { ...emptyPractice, form: "WRAITH", host: "NOLAN", flag: "RAISED" }
    : { ...emptyPractice, note: "WRITTEN" };
  const label = caseId === "reflected-room" ? "经同一原镜实际返回原室并盖镜"
    : caseId === "willing-signal" ? "实际退出诺兰并放回同一原旗" : "亲手交回同一原记录纸";
  return wraith({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", contactOpen: "本次实际接触仍在", result: "本次实际结果已保存，尚须结束。" } : entry),
    actions: [action({ type: "CLOSE", caseId }, label, true, zeroClose)], ...patch,
  });
}
function panel(value: WraithProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<WraithPanel wraith={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Wraith public endpoints, finite possession, moon weakness and original bottles", () => {
  it("shows maturity, honest source costs and unknown ritual while omitting unverified recipe data", () => {
    const reason = "活尸扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原导师保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(wraith({ digestion: reason, supplies, formula: [{ name: "未核材料不能显示", quantity: 9, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "怨魂成长下一步" });
    expect(summary.textContent).toContain(reason); expect(summary.textContent).not.toContain("5步劳务");
    const boundary = screen.getByText("成品来源、费用与配方边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["活尸消化100", "十二个完整序列6周", "指导460便士", "每瓶4800便士", "5步劳务抵扣4200便士后付600便士", "意志26四档", "完整配方、材料与6→5晋升仪式细节尚未掌握；这里只提供有来源的独立成品与导师准备，不解锁调配，服药前仍须完成准备。晋升须先结束旧活尸接触并度过原待处理月圆。", "服药前仍须完成准备", "度过原待处理月圆"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取怨魂成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核材料不能显示")).toBeNull(); expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, independent labour, payment and actual resupply commands", async () => {
    const commands: WraithCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "wraith-potion-3" },
      { type: "BUY_POTION", bottleId: "wraith-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付款领取第二瓶", "请求后续独立原瓶", "实际接收次周补给"];
    const { onCommand } = panel(wraith({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
  });

  it("cancels each independent bottle without spending and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶怨魂魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶怨魂魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶怨魂魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶怨魂魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶怨魂魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("confirms only the selected source bottle once with the latest resources and risk", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶怨魂魔药」" }));
    expect(screen.getByText("wraith-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶独立成品，独立采购记录")).toBeTruthy();
    const riskRegion = screen.getByRole("region", { name: "怨魂服用风险与四档结果" });
    for (const text of [risk, "极端虚弱", "替代活尸、狼人、疯子", "不永久解除诅咒"]) expect(riskRegion.textContent).toContain(text);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶怨魂魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "wraith-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains submitted confirmation after save failure and never resubmits or invents a consumed bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶怨魂魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶怨魂魔药」" }));
    rerender(<WraithPanel wraith={value} resources={resources} busy={false} error={{ message: "原操作保存失败", retryable: true }} onCommand={onCommand} />);
    const confirmation = screen.getByRole("region", { name: "这瓶怨魂魔药的服用确认" });
    expect(confirmation.textContent).toContain("已取得，尚未服用"); expect(screen.getByRole("status").textContent).toContain("请使用保存错误处的重试操作。");
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶怨魂魔药的服用确认" })).toBeTruthy();
    rerender(<WraithPanel wraith={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶怨魂魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<WraithPanel wraith={{ ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "已实际耗用" })) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶怨魂魔药的服用确认" })).toBeNull(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("refreshes the selected bottle risk and conditions and dismisses an unavailable original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶怨魂魔药」" }));
    const updated = { ...value, risk: "当前精神不足，仍保留原瓶。", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "当前精神须高于40。" })) };
    rerender(<WraithPanel wraith={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第三瓶怨魂魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    rerender(<WraithPanel wraith={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶怨魂魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["reflected-room", "willing-signal"])("forwards both methods and actual execution for %s without inventing its outcome", async (caseId) => {
    const ability = action({ type: "PREPARE", caseId, method: "ABILITY" }, "准备本次有限能力方法", true, "1行动");
    const ordinary = action({ type: "PREPARE", caseId, method: "ORDINARY" }, "准备本次普通方法", true, "1行动");
    const value = wraith({ promoted: true, cases: cases(), actions: [ability, ordinary] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(caseId);
    await userEvent.click(screen.getByRole("button", { name: /^准备本次有限能力方法/ }));
    await userEvent.click(screen.getByRole("button", { name: /^准备本次普通方法/ }));
    expect(screen.getByText("本人已显现为人形")).toBeTruthy(); expect(screen.getByText("本人没有附在诺兰身上")).toBeTruthy();
    const perform = action({ type: "PERFORM", caseId }, "执行已准备的本次方法", true, "1行动 · 3灵性 · 知识14");
    rerender(<WraithPanel wraith={{ ...value, actions: [perform], cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "PREPARED", preparation: "已选择方法，尚未实际执行。" } : entry) }}
      resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^执行已准备的本次方法/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([ability.command, ordinary.command, perform.command]);
    expect(screen.queryByRole("region", { name: "怨魂实际结果" })).toBeNull();
    expect(screen.getByText("原工坊室内（ROOM）")).toBeTruthy(); expect(screen.getByText("同一原信号旗 WF5-FLAG-1 在原桌上")).toBeTruthy();
  });

  it("shows actual mirrored endpoints and requires the paid real return at zero AP and zero S", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, spirituality: 0, mind: 0 });
    const current = screen.getByRole("region", { name: "已保存的形态、端点、附体与原物状态" });
    for (const text of ["本人当前处于怨魂形态", "四米外原壁龛（ALCOVE）", "均已揭开", "WF5-MIRROR-ROOM", "WF5-MIRROR-ALCOVE", "没有把另一具身体留在出发点"])
      expect(current.textContent).toContain(text);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("reflected-room"); expect(selector.disabled).toBe(true);
    const practice = screen.getByRole("region", { name: "当前怨魂实践" });
    for (const text of ["3灵性", "预付本次有限去回总预算", "经原镜返回原室", "失败仍可能已到壁龛", "不另抽结果、不退款"]) expect(practice.textContent).toContain(text);
    const close = screen.getByRole("button", { name: /^经同一原镜实际返回原室并盖镜/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(current.textContent).toContain("四米外原壁龛（ALCOVE）");
    const report = action({ type: "REPORT", caseId: "reflected-room" }, "报告实际去回", true, "1行动 · 25扮演 · 8知识池掌握");
    rerender(<WraithPanel wraith={{ ...value, insideCase: false, practice: { ...emptyPractice }, actions: [report] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(current.textContent).toContain("本人已显现为人形"); expect(current.textContent).toContain("原工坊室内（ROOM）"); expect(current.textContent).toContain("均已盖好");
    await userEvent.click(screen.getByRole("button", { name: /^报告实际去回/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, report.command]);
    expect((screen.getByRole("progressbar") as HTMLProgressElement).value).toBe(0);
  });

  it("keeps ordinary corridor travel human and forwards its actual ordinary return", async () => {
    const close = action({ type: "CLOSE", caseId: "reflected-room" }, "沿同一原侧廊实际步行返回", true, zeroClose);
    const value = opened("reflected-room", { practice: { ...emptyPractice, node: "ALCOVE", mirror: "OPEN" }, actions: [close],
      cases: cases().map((entry) => entry.id === "reflected-room" ? { ...entry, result: "本人以普通方法步行四米至原壁龛，没有镜面跳跃。" } : entry) });
    const { onCommand } = panel(value);
    expect(screen.getByText("本人已显现为人形")).toBeTruthy(); expect(screen.getByText("四米外原壁龛（ALCOVE）")).toBeTruthy();
    expect(screen.getByRole("region", { name: "怨魂实际结果" }).textContent).toContain("没有镜面跳跃");
    await userEvent.click(screen.getByRole("button", { name: /^沿同一原侧廊实际步行返回/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("keeps successful possession on the same Nolan and original raised flag until committed exit", async () => {
    const value = opened("willing-signal"); const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, spirituality: 0 });
    const current = screen.getByRole("region", { name: "已保存的形态、端点、附体与原物状态" });
    expect(current.textContent).toContain("本人仍附在原成年参与者诺兰身上，须实际退出"); expect(current.textContent).toContain("WF5-FLAG-1 已举起");
    const practice = screen.getByRole("region", { name: "当前怨魂实践" });
    for (const text of ["只同意本次一次举旗", "随时可停止", "成功后须实际退出同一诺兰", "普通方法只请他自愿举旗，不算附体"]) expect(practice.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^实际退出诺兰并放回同一原旗/ }));
    expect(current.textContent).toContain("仍附在"); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    rerender(<WraithPanel wraith={{ ...value, insideCase: false, practice: { ...emptyPractice }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(current.textContent).toContain("本人没有附在诺兰身上"); expect(current.textContent).toContain("WF5-FLAG-1 在原桌上");
    expect(current.textContent).toContain("本人已显现为人形");
  });

  it("shows actual repulsion without fake success and still permits acknowledgement at zero resources", async () => {
    const failed = "本次附体实际被诺兰排斥；本人已显形，原旗仍在桌上，已付3灵性，尚须结束本次接触。";
    const exit = action({ type: "CLOSE", caseId: "willing-signal" }, "确认已被排斥并实际结束本次接触", true, zeroClose);
    const value = opened("willing-signal", { practice: { ...emptyPractice }, actions: [exit],
      cases: cases().map((entry) => entry.id === "willing-signal" ? { ...entry, status: "OBSERVED", result: failed, contactOpen: "失败后尚未结束" } : entry),
      abilities: [{ id: "chained.s5.spirit-possession", label: "灵体攻击与有限附身", mastery: 0, description: "本次失败未增加掌握。" }] });
    const { onCommand } = panel(value, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    expect(screen.getByRole("region", { name: "怨魂实际结果" }).textContent).toContain(failed);
    expect(screen.getByText("本人没有附在诺兰身上")).toBeTruthy(); expect(screen.getByText("灵体攻击与有限附身 · 掌握 0")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1); expect(screen.queryByRole("button", { name: /报告|重试|奖励/ })).toBeNull();
    const close = screen.getByRole("button", { name: /^确认已被排斥并实际结束本次接触/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith(exit.command);
    expect(screen.getByText(failed)).toBeTruthy();
  });

  it("identifies the current exit by its public command and hides unrelated or premature actions", () => {
    const value = opened("willing-signal"); value.actions.unshift(action({ type: "CLOSE", caseId: "reflected-room" }, "旧去回不能重做", false));
    value.actions.push(action({ type: "PERFORM", caseId: "willing-signal" }, "不能再次附体"), action({ type: "WITHDRAW", caseId: "willing-signal" }, "不能把已执行当撤回"),
      action({ type: "REPORT", caseId: "willing-signal" }, "不能提前报告"), action({ type: "REFLECT" }, "不能提前反思"),
      action({ type: "PREPARE", caseId: "honest-account", method: "ORDINARY" }, "不能换案"), action({ type: "ENCOUNTER_FIGHT" }, "不能开战"));
    const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("willing-signal");
    expect(screen.getAllByRole("button")).toHaveLength(1); expect(screen.getByRole("button", { name: /^实际退出诺兰/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /旧去回|再次|撤回|报告|反思|换案|开战/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("offers only ordinary preparation for the actual record and keeps unstarted withdrawal distinct", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "honest-account", method: "ORDINARY" }, "准备普通如实记录", true, "1行动 · 0灵性");
    const value = wraith({ promoted: true, cases: cases(), actions: [ordinary,
      action({ type: "PREPARE", caseId: "honest-account", method: "ABILITY" }, "不可变成真相能力")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("honest-account");
    expect(screen.queryByRole("button", { name: /真相能力/ })).toBeNull(); await userEvent.click(screen.getByRole("button", { name: /^准备普通如实记录/ }));
    const withdraw = action({ type: "WITHDRAW", caseId: "honest-account" }, "撤回尚未执行的准备", true, zeroClose);
    rerender(<WraithPanel wraith={{ ...value, actions: [withdraw], cases: cases().map((entry) => entry.id === "honest-account" ? { ...entry, status: "PREPARED" } : entry) }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未执行的准备/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([ordinary.command, withdraw.command]);
    expect(screen.getByText("同一原记录纸 WF5-NOTE-1 尚未写本次记录")).toBeTruthy();
  });

  it("retains failed writing on the original note and requires the actual physical handoff", async () => {
    const failure = "这次核对失败，文字已写在同一张原纸；先交回，下一真实周在原纸更正。";
    const value = opened("honest-account", { cases: cases().map((entry) => entry.id === "honest-account" ? { ...entry, status: "OBSERVED", result: failure } : entry) });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("同一原记录纸 WF5-NOTE-1 已写，尚未交回")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^亲手交回同一原记录纸/ }));
    expect(screen.getByText("同一原记录纸 WF5-NOTE-1 已写，尚未交回")).toBeTruthy();
    rerender(<WraithPanel wraith={{ ...value, insideCase: false, practice: { ...emptyPractice, note: "HANDED_OVER" }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原记录纸 WF5-NOTE-1 已实际交回")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it("prioritizes actual moon weakness and only projected guarded or alone choices", async () => {
    const guarded = action({ type: "HANDLE_MOON", method: "GUARDED" }, "请原哈伦守望至本次虚弱结束", true, "0行动 · 至多10精神 · 0灵性");
    const alone = action({ type: "HANDLE_MOON", method: "ALONE" }, "留在当前地点独自度过虚弱", true, "0行动 · 至多20精神 · 0灵性");
    const moon = { pending: true, summary: "第60周已公示发作：怨魂当前极端虚弱。", history: [{ week: 55, method: "ALONE" as const, mentalCost: 7 }] };
    const value = wraith({ promoted: true, insideCase: true, cases: cases(), moon, actions: [guarded, alone,
      action({ type: "REFLECT" }, "不能反思"), action({ type: "ENCOUNTER_FIGHT" }, "不能战斗"), action({ type: "OBSERVE", caseId: "reflected-room" }, "不能观察")] });
    const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    expect(screen.getByRole("region", { name: "怨魂成长下一步" }).textContent).toContain("不能战斗或进行普通活动");
    const current = screen.getByRole("region", { name: "怨魂月圆极端虚弱与实际度过" });
    for (const text of [moon.summary, "当前精神与10中的较小值", "当前精神与20中的较小值", "精神为0仍可结束", "不恢复健康或灵性", "不增加扮演", "不叠加活尸剧痛", "不按每四周推算"])
      expect(current.textContent).toContain(text);
    expect(screen.getByText("第55周 · 原地点独自承受并等过虚弱 · 实际精神消耗7")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2); expect(screen.queryByRole("combobox")).toBeNull();
    const close = screen.getByRole("button", { name: /^留在当前地点独自度过虚弱/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(alone.command); expect(current.textContent).toContain(moon.summary);
    rerender(<WraithPanel wraith={{ ...value, insideCase: false, actions: [], moon: { pending: false, summary: "本次已实际度过，后续未展开不代表解咒。", history: [...moon.history, { week: 60, method: "ALONE", mentalCost: 0 }] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("第60周 · 原地点独自承受并等过虚弱 · 实际精神消耗0")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /虚弱/ })).toBeNull();
  });

  it("keeps actual guardian availability and costs from the public actions without manufacturing a kill option", async () => {
    const guarded = { ...action({ type: "HANDLE_MOON", method: "GUARDED" }, "请原哈伦协助", false, "0行动 · 至多10精神"), reason: "当前不在贝克兰德原哈伦工坊。" };
    const alone = action({ type: "HANDLE_MOON", method: "ALONE" }, "在原地点独自等过本次发作", true, "0行动 · 至多20精神");
    const { onCommand } = panel(wraith({ promoted: true, moon: { pending: true, summary: "本次虚弱待处理", history: [] }, actions: [guarded, alone] }));
    const guardButton = screen.getByRole("button", { name: /^请原哈伦协助/ }) as HTMLButtonElement;
    expect(guardButton.disabled).toBe(true); fireEvent.click(guardButton); expect(screen.getByText(guarded.reason)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /杀|吞|吸取|献祭|传送/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^在原地点独自等过本次发作/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(alone.command);
  });

  it("does not strand an actual open contact behind a pending moon and does not invent a missing exit", () => {
    const value = opened("willing-signal", { moon: { pending: true, summary: "发作仍待处理", history: [] } });
    value.actions.push(action({ type: "HANDLE_MOON", method: "ALONE" }, "必须先结束原接触"));
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("button")).toHaveLength(1); expect(screen.getByRole("button", { name: /^实际退出诺兰/ })).toBeTruthy();
    rerender(<WraithPanel wraith={{ ...value, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "怨魂成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.getByText("本人仍附在原成年参与者诺兰身上，须实际退出")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("never infers current possession or moon from old prose, unexposed fields or history", () => {
    const value = { ...wraith({ promoted: true, cases: cases(), actions: [], story: "旧记录提到NOLAN、WRAITH与月圆，不能当成当前附体或发作。",
      moon: { pending: false, summary: "本次没有待处理发作。", history: [{ week: 55, method: "GUARDED", mentalCost: 10 }] } }),
      privateThought: "SECRET_THOUGHT", nextRoll: "SECRET_ROLL", hiddenVictim: "SECRET_VICTIM" };
    const { container, onCommand } = panel(value);
    for (const secret of [value.privateThought, value.nextRoll, value.hiddenVictim]) expect(container.textContent).not.toContain(secret);
    expect(screen.getByText("本人没有附在诺兰身上")).toBeTruthy(); expect(screen.getByText("本人已显现为人形")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "怨魂成长下一步" }).textContent).not.toContain("先度过"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks mutation and selection for busy, external block and save error while retaining actual state", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "返回保存失败", retryable: true } }]) {
      rerender(<WraithPanel wraith={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("四米外原壁龛（ALCOVE）")).toBeTruthy(); expect(screen.getByText("本人当前处于怨魂形态")).toBeTruthy();
    }
    rerender(<WraithPanel wraith={value} resources={resources} busy={false} error={{ message: "须重读保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains peaceful100, real inherited mastery and bounded Bevan choices without S4 powers", async () => {
    const abilities = [{ id: "chained.s5.reflection-step", label: "灵化与反射面移动", mastery: 0, description: "本次普通路线没有新增能力掌握。" },
      { id: "chained.s5.spirit-possession", label: "灵体攻击与有限附身", mastery: 0, description: "没有虚构附体成功。" },
      { id: "chained.s6.steel-body", label: "原钢铁躯体", mastery: 17, description: "继承原真实训练。" }];
    const talk = action({ type: "ENCOUNTER_TALK" }, "与贝文实际交涉"); const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担贝文有限冲突");
    const { onCommand } = panel(wraith({ promoted: true, acting: 100, digestion: "本阶段已消化", abilities, actions: [talk, fight] }));
    expect((screen.getByRole("progressbar", { name: "怨魂扮演进度" }) as HTMLProgressElement).value).toBe(100);
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("怨魂能力与来源边界");
    for (const text of ["不会留下一具独立身体", "只带原有衣物", "真实反射条件与端点", "300米不是所有初晋升怨魂", "附体可能失败或被排斥", "全部采用普通方法也可完成", "8点知识池掌握", "序列4木偶，晋升请从对应入口查看"])
      expect(boundary.textContent).toContain(text);
    const encounter = screen.getByRole("region", { name: "怨魂有限冲突" });
    for (const text of ["原成年看守贝文", "自己的普通短棍", "相距2米", "日光", "对方不追击", "不会凭空补出第二面镜子", "本次动作内实际退出", "不提供整轮免疫"])
      expect(encounter.textContent).toContain(text);
    await userEvent.click(within(encounter).getByRole("button", { name: /^与贝文实际交涉/ })); await userEvent.click(within(encounter).getByRole("button", { name: /^承担贝文有限冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /木偶|纸人|诅咒|无敌|秒杀|永久/ })).toBeNull();
  });

  it("preserves old Zombie facts, failed practice, costs, bottles, risk and mastery read-only", () => {
    const zombie: ZombieProjection = {
      title: "活尸", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      story: "原活尸故事与实际失败。", environment: "原里德实际战死，原后果保留。", supplies: "原独立活尸瓶供给与实际消耗。",
      acting: 100, digestion: "已消化", pollution: 4, risk: "原活尸意志24四档风险。", insideCase: false,
      practice: { body: "NORMAL", cold: "THAWED", spirit: "RELEASED" },
      moon: { pending: false, summary: "原活尸第51周已度过剧痛。", history: [{ week: 46, method: "GUARDED", mentalCost: 10 }, { week: 51, method: "ALONE", mentalCost: 7 }] },
      actions: [{ id: "old-reflect", label: "不可重新执行原活尸成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: [{ id: "willing-spirit", title: "原赫姆有限协助", story: "第一次指认失败，原消耗保留。", status: "RESOLVED", observations: ["同一原箱标仍在，原赫姆接触已解除。"],
        preparation: "按本人意愿核对同一原标记。", result: "后来完成有限报告，第一次失败仍保留。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "zombie-old-1", title: "活尸旧原瓶", source: "原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "zombie-old-1", confirmed: true } }],
      abilities: [{ id: "chained.s6.steel-body", label: "原钢铁躯体", mastery: 17, description: "原真实承力掌握。" }],
    };
    render(<WraithZombieHistory zombie={zombie} />);
    const history = within(screen.getByRole("region", { name: "活尸时期的经历" }));
    for (const text of [zombie.story!, zombie.environment, zombie.supplies, "本人处于日常姿态", "同一原冷盘已实际回温", "已实际解除与赫姆的本次接触", zombie.risk,
      "第一次指认失败，原消耗保留。", "原案卷ID：willing-spirit", "同一原箱标仍在，原赫姆接触已解除。", "当时的方式与准备：按本人意愿核对同一原标记。",
      "当时的实际结果与报告：后来完成有限报告，第一次失败仍保留。", "当时的接触：已实际结束 · 实际结束次数：2", zombie.moon.summary,
      "第46周 · 原哈伦工坊看守过夜 · 原实际精神消耗10", "第51周 · 原地点停止接触并独自过夜 · 原实际精神消耗7",
      "原瓶ID：zombie-old-1", "来源：原独立成品渠道", "已耗用 · 原失败保留", "原钢铁躯体 · 掌握 17：原真实承力掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByText("不可重新执行原活尸成长")).toBeNull(); expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
