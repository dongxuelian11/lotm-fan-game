/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WinnerAction, WinnerCommand, WinnerProjection } from "../../src/domain/winner/types";
import type { CalamityPriestProjection } from "../../src/domain/calamity-priest/types";
import { WinnerPanel, WinnerCalamityPriestHistory } from "../../src/renderer/WinnerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyPractice: WinnerProjection["practice"] = { counter: "GUIDE", ring: "OWNER", note: "BLANK" };
const emptyLuck: WinnerProjection["luck"] = { stored: 0, lastAccumulateWeek: null, accumulated: 0, spent: 0, capacity: 3, summary: "尚无实际储运；晋升未赠送幸运。" };
const risk = "意志26：大成功与成功晋升；失败与灾难仍耗原瓶，原排异和污染保留。健康须高于20、精神须高于40；晋升不补满灵性。";
function action(command: WinnerCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): WinnerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取赢家成品用药指导", true, "460便士 · 1行动");
function winner(patch: Partial<WinnerProjection> = {}): WinnerProjection {
  return {
    title: "赢家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "灾祸教士扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: { ...emptyPractice }, luck: { ...emptyLuck }, ...patch,
  };
}
function cases(): WinnerProjection["cases"] {
  return [
    { id: "falling-counter", title: "同一原木筹的有限接取", story: "艾妲在低台原软接盘上方放下原木筹，无人在落物下方。" },
    { id: "willing-aim", title: "塞拉同意的一次原环瞄准", story: "原成年塞拉只同意本次一次安全投环，随时可以停止。" },
    { id: "honest-account", title: "同一原纸的有限记录", story: "只记录已经实际发生的结果，原失败文字保留。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): WinnerProjection {
  const originals = [
    { id: "winner-potion-1", title: "第一瓶赢家魔药", source: "G原渠道第一瓶独立成品，艾妲实际准备", chance: 71 },
    { id: "winner-potion-2", title: "第二瓶赢家魔药", source: "G原渠道第二瓶独立成品，独立采购记录", chance: 43 },
    { id: "winner-potion-3", title: "第三瓶赢家魔药", source: "G原渠道第三瓶独立成品，独立封装记录", chance: 61 },
  ];
  return winner({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶4800便士或五步劳务后600便士。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const zeroClose = "0行动 · 0精神 · 0灵性 · 0储运";
function opened(caseId = "falling-counter", patch: Partial<WinnerProjection> = {}): WinnerProjection {
  const practice: WinnerProjection["practice"] = caseId === "falling-counter" ? { ...emptyPractice, counter: "CAUGHT" }
    : caseId === "willing-aim" ? { ...emptyPractice, ring: "MAT" } : { ...emptyPractice, note: "WRITTEN" };
  const label = caseId === "falling-counter" ? "亲手将同一原木筹交回艾妲"
    : caseId === "willing-aim" ? "由塞拉实际取回同一原环并结束试验" : "亲手交回同一原记录纸";
  return winner({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", contactOpen: "本次实际接触仍在", result: "本次实际结果已保存，尚须结束。" } : entry),
    actions: [action({ type: "CLOSE", caseId }, label, true, zeroClose)], ...patch,
  });
}
function panel(value: WinnerProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<WinnerPanel winner={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Winner public reserve, actual original objects and independent bottles", () => {
  it("shows original acquisition costs and maturity without exposing unverified recipe or hidden fate", () => {
    const reason = "灾祸教士扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原艾妲保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const value = { ...winner({ digestion: reason, supplies, formula: [{ name: "未核材料不能显示", quantity: 9, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }),
      hiddenFate: "SECRET_FATE", nextRoll: "SECRET_ROLL", targetThought: "SECRET_THOUGHT" };
    const { container, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "赢家成长下一步" }).textContent).toContain(reason);
    const boundary = screen.getByText("成品来源、费用与配方边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["灾祸教士消化100", "十二个完整序列6周", "460便士", "4800便士", "5步劳务抵扣4200便士后付600便士", "意志26四档", "完整配方、材料与6→5晋升仪式细节尚未掌握；这里只提供有来源的独立成品与导师准备，不解锁调配，服药前仍须完成准备。晋升须先结束旧灾祸教士接触；健康须高于20、精神须高于40，成功后灵性上限100但不补满。", "服药前仍须完成准备", "健康须高于20", "不补满"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    for (const secret of ["未核材料不能显示", value.hiddenFate, value.nextRoll, value.targetThought]) expect(container.textContent).not.toContain(secret);
    const button = screen.getByRole("button", { name: /^听取赢家/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, independent labour, payment and real resupply commands", async () => {
    const commands: WinnerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "winner-potion-3" },
      { type: "BUY_POTION", bottleId: "winner-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付款领取第二瓶", "请求后续独立原瓶", "实际接收次周补给"];
    const { onCommand } = panel(winner({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
  });

  it("cancels the selected original bottle without spending and restores focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶赢家魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶赢家魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶赢家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶赢家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶赢家魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("confirms only the exact action for the selected source bottle once", async () => {
    const value = bottled(); value.bottles[1]!.command = { type: "CONSUME", bottleId: "not-an-offered-action", confirmed: true };
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶赢家魔药」" }));
    expect(screen.getByText("winner-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶独立成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "赢家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶赢家魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains submitted confirmation and the unconsumed bottle after a save error without resubmitting", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶赢家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶赢家魔药」" }));
    rerender(<WinnerPanel winner={value} resources={resources} busy={false} error={{ message: "原操作保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "这瓶赢家魔药的服用确认" }).textContent).toContain("已取得，尚未服用");
    expect(screen.getByRole("status").textContent).toContain("请使用保存错误处的重试操作。");
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶赢家魔药的服用确认" })).toBeTruthy();
    rerender(<WinnerPanel winner={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶赢家魔药」" }) as HTMLButtonElement).disabled).toBe(true); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<WinnerPanel winner={{ ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "已实际耗用" })) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶赢家魔药的服用确认" })).toBeNull(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "已保存储运 0 / 3" })).toBeTruthy();
  });

  it("uses current bottle risk and conditions and dismisses a removed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶赢家魔药」" }));
    const updated = { ...value, risk: "当前精神不足，仍保留原瓶。", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "当前精神须高于40。" })) };
    rerender(<WinnerPanel winner={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第三瓶赢家魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    rerender(<WinnerPanel winner={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶赢家魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("begins empty and sends accumulation without optimistic reserve, healing or success", async () => {
    const accumulate = action({ type: "ACCUMULATE" }, "在原艾妲指导室实际节制积累", true, "1行动 · 0灵性 · 1份储运");
    const value = winner({ promoted: true, actions: [accumulate] }); const { onCommand, rerender } = panel(value);
    const bank = screen.getByRole("region", { name: "赢家实际储运" });
    for (const text of [emptyLuck.summary, "已保存储运 0 / 3", "尚未实际积累", "每个真实周最多一次", "不治疗健康、精神或灵性", "普通方法", "原被动幸运的独立判定"])
      expect(bank.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^在原艾妲指导室实际节制积累/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(accumulate.command); expect(bank.textContent).toContain("已保存储运 0 / 3");
    rerender(<WinnerPanel winner={{ ...value, luck: { ...emptyLuck, stored: 1, accumulated: 1, lastAccumulateWeek: 57, summary: "第57周实际积累1份，当前储运1。" } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(bank.textContent).toContain("已保存储运 1 / 3"); expect(within(bank).getByText("第57周")).toBeTruthy();
  });

  it.each([
    { stored: 0, accumulated: 1, spent: 1, reason: "本真实周已积累过，须等下一真实周。" },
    { stored: 3, accumulated: 5, spent: 2, reason: "储运已达容量3，本次不能继续积累。" },
  ])("keeps the projected reserve limit visible: $reason", ({ stored, accumulated, spent, reason }) => {
    const unavailable = { ...action({ type: "ACCUMULATE" }, "实际积累储运", false, "1行动 · 0灵性"), reason };
    const { onCommand } = panel(winner({ promoted: true, actions: [unavailable], luck: { ...emptyLuck, stored, accumulated, spent, lastAccumulateWeek: 59 } }));
    const bank = screen.getByRole("region", { name: "赢家实际储运" });
    expect(bank.textContent).toContain(`已保存储运 ${stored} / 3`); expect(within(bank).getByText(reason)).toBeTruthy();
    expect(bank.querySelector("dl")?.textContent).toContain(`累计实际积累${accumulated}累计实际消耗${spent}`);
    const button = within(bank).getByRole("button", { name: /^实际积累储运/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["falling-counter", "willing-aim"])("sends exact ability or ordinary preparation and actual execution for %s", async (caseId) => {
    const ability = action({ type: "PREPARE", caseId, method: "ABILITY" }, "准备本次有限能力方法", true, "1行动");
    const ordinary = action({ type: "PREPARE", caseId, method: "ORDINARY" }, "准备本次普通方法", true, "1行动");
    const value = winner({ promoted: true, cases: cases(), actions: [ability, ordinary], luck: { ...emptyLuck, stored: 1, accumulated: 1, lastAccumulateWeek: 56 } });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(caseId);
    const practice = screen.getByRole("region", { name: "当前赢家实践" });
    for (const text of caseId === "falling-counter" ? ["知识9", "原难度14", "10个百分点", "不改变原随机结果", "知识12", "交还艾妲"]
      : ["只同意本次一次安全投环", "2灵性、1份储运", "知识14", "失败仍消耗", "知识10", "塞拉实际取回同一原环"])
      expect(practice.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^准备本次有限能力方法/ }));
    await userEvent.click(screen.getByRole("button", { name: /^准备本次普通方法/ }));
    expect(screen.getByRole("heading", { name: "已保存储运 1 / 3" })).toBeTruthy();
    const perform = action({ type: "PERFORM", caseId }, "执行已准备的本次方法", true, "1行动 · 2灵性 · 1份储运");
    rerender(<WinnerPanel winner={{ ...value, actions: [perform] }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^执行已准备的本次方法/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([ability.command, ordinary.command, perform.command]);
    expect(screen.queryByRole("region", { name: "赢家实际结果" })).toBeNull();
    expect(screen.getByText("同一原木筹 WN5-COUNTER-1 在艾妲手中")).toBeTruthy(); expect(screen.getByText("同一原环 WN5-RING-1 在塞拉手中")).toBeTruthy();
  });

  it("preserves empty-bank rejection while allowing the offered ordinary alternative", async () => {
    const reason = "当前储运0，能力准备须有至少1份；先查看积累条件或选普通方法。";
    const ability = { ...action({ type: "PREPARE", caseId: "falling-counter", method: "ABILITY" }, "准备储运接筹", false), reason };
    const ordinary = action({ type: "PREPARE", caseId: "falling-counter", method: "ORDINARY" }, "准备原软盘普通接取");
    const { onCommand } = panel(winner({ promoted: true, cases: cases(), actions: [ability, ordinary] }));
    const magic = screen.getByRole("button", { name: /^准备储运接筹/ }) as HTMLButtonElement;
    expect(magic.disabled).toBe(true); fireEvent.click(magic); expect(screen.getByText(reason)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^准备原软盘普通接取/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("button", { name: /积累|充值|重掷/ })).toBeNull();
  });

  it.each(["CAUGHT", "TRAY"] as const)("keeps the same counter in %s until real zero-resource handback", async (counter) => {
    const result = counter === "TRAY" ? "能力判定失败，原木筹落入原软接盘；已付2灵性和1份储运，尚未归还。" : "能力接稳原木筹，已付2灵性和1份储运，尚未归还。";
    const value = opened("falling-counter", { practice: { ...emptyPractice, counter }, luck: { ...emptyLuck, accumulated: 1, spent: 1, lastAccumulateWeek: 56 },
      cases: cases().map((entry) => entry.id === "falling-counter" ? { ...entry, status: counter === "TRAY" ? "OBSERVED" : "EXAMINED", result } : entry) });
    const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, spirituality: 0, mind: 0 });
    const current = screen.getByRole("region", { name: "已保存的原木筹、原环与原纸状态" });
    expect(current.textContent).toContain(counter === "TRAY" ? "已落在原软接盘内，尚未交回" : "已实际接稳，尚未交回");
    expect(screen.getByRole("region", { name: "赢家实际结果" }).textContent).toContain(result);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    const close = screen.getByRole("button", { name: /^亲手将同一原木筹交回艾妲/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(current.textContent).toContain("尚未交回");
    const report = action({ type: "REPORT", caseId: "falling-counter" }, "报告真实接取结果");
    rerender(<WinnerPanel winner={{ ...value, insideCase: false, practice: { ...emptyPractice }, actions: counter === "CAUGHT" ? [report] : [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(current.textContent).toContain("在艾妲手中"); expect(screen.getByText(result)).toBeTruthy(); expect(screen.getByRole("heading", { name: "已保存储运 0 / 3" })).toBeTruthy();
    if (counter === "TRAY") expect(screen.queryByRole("button", { name: /报告|奖励|重试/ })).toBeNull();
  });

  it("keeps the failed original ring on the mat until Sella retrieves it and never invents control", async () => {
    const failure = "本次厄运施用失败，塞拉已实际投出原环；原环在原软垫，2灵性和1份储运已耗用。";
    const value = opened("willing-aim", { luck: { ...emptyLuck, accumulated: 1, spent: 1, lastAccumulateWeek: 57 },
      cases: cases().map((entry) => entry.id === "willing-aim" ? { ...entry, status: "OBSERVED", result: failure } : entry),
      abilities: [{ id: "wheel.s5.ill-fortune", label: "有限厄运", mastery: 0, description: "本次失败未增加掌握。" }] });
    value.actions.unshift(action({ type: "CLOSE", caseId: "falling-counter" }, "旧木筹不能重做", false));
    value.actions.push(action({ type: "ACCUMULATE" }, "不能接触中补运"), action({ type: "PERFORM", caseId: "willing-aim" }, "不能强制重投"),
      action({ type: "WITHDRAW", caseId: "willing-aim" }, "不能把已执行当撤回"), action({ type: "REPORT", caseId: "willing-aim" }, "不能提前报告"),
      action({ type: "REFLECT" }, "不能提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不能开战"));
    const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, spirituality: 0 });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("willing-aim"); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText("有限厄运 · 掌握 0")).toBeTruthy();
    expect(screen.getByText("同一原环 WN5-RING-1 已落在原软垫上，尚须由塞拉取回")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^由塞拉实际取回同一原环/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(screen.getByText("同一原环 WN5-RING-1 已落在原软垫上，尚须由塞拉取回")).toBeTruthy();
    rerender(<WinnerPanel winner={{ ...value, insideCase: false, practice: { ...emptyPractice }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原环 WN5-RING-1 在塞拉手中")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
  });

  it("offers ordinary accounting only and retains failed writing until physical handoff", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "honest-account", method: "ORDINARY" }, "准备普通如实记录");
    const value = winner({ promoted: true, cases: cases(), actions: [ordinary, action({ type: "PREPARE", caseId: "honest-account", method: "ABILITY" }, "不可变成真相能力")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("honest-account"); expect(screen.queryByRole("button", { name: /真相能力/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^准备普通如实记录/ }));
    const failure = "这次核对失败，文字已写在同一张原纸；先交回，下一真实周在原纸更正。";
    const written = opened("honest-account", { cases: cases().map((entry) => entry.id === "honest-account" ? { ...entry, status: "OBSERVED", result: failure } : entry) });
    rerender(<WinnerPanel winner={written} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原记录纸 WN5-NOTE-1 已写，尚未交回")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^亲手交回同一原记录纸/ }));
    expect(screen.getByText("同一原记录纸 WN5-NOTE-1 已写，尚未交回")).toBeTruthy();
    rerender(<WinnerPanel winner={{ ...written, insideCase: false, practice: { ...emptyPractice, note: "HANDED_OVER" }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原记录纸 WN5-NOTE-1 已实际交回")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([ordinary.command, written.actions[0]!.command]);
  });

  it("keeps withdrawal distinct and does not invent a missing close or accumulation action", async () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "falling-counter" }, "撤回尚未执行的准备", true, zeroClose);
    const value = winner({ promoted: true, cases: cases(), actions: [withdraw] }); const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未执行的准备/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    rerender(<WinnerPanel winner={opened("falling-counter", { insideCase: false, actions: [] })} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "赢家成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText("同一原木筹 WN5-COUNTER-1 已实际接稳，尚未交回")).toBeTruthy();
  });

  it("locks mutation for busy, external blocks and save error without changing original state", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "归还保存失败", retryable: true } }]) {
      rerender(<WinnerPanel winner={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("同一原木筹 WN5-COUNTER-1 已实际接稳，尚未交回")).toBeTruthy();
    }
    rerender(<WinnerPanel winner={value} resources={resources} busy={false} error={{ message: "须重读保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps peaceful100 separate from bank, mastery and limited encounter choices", async () => {
    const abilities = [{ id: "wheel.s5.luck-reserve", label: "幸运积累与有限运用", mastery: 0, description: "普通路线没有新增能力掌握。" },
      { id: "wheel.s5.ill-fortune", label: "有限厄运", mastery: 0, description: "没有虚构厄运成功。" },
      { id: "wheel.s7.passive-luck", label: "原被动幸运", mastery: 17, description: "继承原真实掌握。" }];
    const talk = action({ type: "ENCOUNTER_TALK" }, "与奥德里实际交涉"); const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担奥德里有限冲突");
    const { onCommand } = panel(winner({ promoted: true, acting: 100, digestion: "本阶段已消化", abilities, actions: [talk, fight] }));
    expect((screen.getByRole("progressbar", { name: "赢家扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("heading", { name: "已保存储运 0 / 3" })).toBeTruthy();
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("赢家能力与来源边界");
    for (const text of ["全部采用普通方法也可完成", "不会自动填满储运", "8点知识池掌握", "不保证胜利、全部真相或任意重掷", "不改写过去", "本页保留赢家序列5的能力范围；序列4晋升请从对应入口查看"])
      expect(boundary.textContent).toContain(text);
    const encounter = screen.getByRole("region", { name: "赢家有限冲突" });
    for (const text of ["原成年奥德里", "自己的普通短棍", "相距2米", "日光", "对方不追击", "默认保留储运", "每轮合计最多一份", "失败照常消耗", "不保证胜利或抵销意外"])
      expect(encounter.textContent).toContain(text);
    await userEvent.click(within(encounter).getByRole("button", { name: /^与奥德里实际交涉/ }));
    await userEvent.click(within(encounter).getByRole("button", { name: /^承担奥德里有限冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /重启|水银|必中|永久|重掷/ })).toBeNull();
  });

  it("preserves original Calamity Priest failures, costs, objects, bottles and mastery read-only", () => {
    const calamityPriest: CalamityPriestProjection = {
      title: "灾祸教士", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      story: "原灾祸教士故事与实际失败。", environment: "原杜兰实际战死，原后果保留。", supplies: "原独立灾祸教士瓶供给与实际消耗。",
      acting: 100, digestion: "已消化", pollution: 4, risk: "原灾祸教士意志24四档风险。", insideCase: false,
      practice: { hazard: "SECURED", board: "SECURED", contact: "RELEASED" },
      actions: [{ id: "old-reflect", label: "不可重新执行原灾祸教士成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: [{ id: "willing-focus", title: "原自愿精神接触", story: "第一次精神试验失败，原消耗保留。", status: "RESOLVED", observations: ["原接触已实际解除。"],
        preparation: "有限精神试验实付3灵性。", result: "后来完成有限报告，第一次失败仍保留。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "calamity-priest-old-1", title: "灾祸教士旧原瓶", source: "原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "calamity-priest-old-1", confirmed: true } }],
      abilities: [{ id: "wheel.s6.mental-storm", label: "原精神风暴", mastery: 17, description: "原真实有限精神接触掌握。" }],
    };
    render(<WinnerCalamityPriestHistory calamityPriest={calamityPriest} />);
    const history = within(screen.getByRole("region", { name: "灾祸教士时期的经历" }));
    for (const text of [calamityPriest.story!, calamityPriest.environment, calamityPriest.supplies, "已实际退出并做好当时风险收束", "同一原板已实际固定收好", "当时的精神接触已实际解除", calamityPriest.risk,
      "第一次精神试验失败，原消耗保留。", "原案卷ID：willing-focus", "原接触已实际解除。", "当时的方式与准备：有限精神试验实付3灵性。",
      "当时的实际结果与报告：后来完成有限报告，第一次失败仍保留。", "当时的接触：已实际结束 · 实际结束次数：2",
      "原瓶ID：calamity-priest-old-1", "来源：原独立成品渠道", "已耗用 · 原失败保留", "原精神风暴 · 掌握 17：原真实有限精神接触掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByText("不可重新执行原灾祸教士成长")).toBeNull(); expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
