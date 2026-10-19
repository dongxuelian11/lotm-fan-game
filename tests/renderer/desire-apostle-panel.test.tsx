/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesireApostleAction, DesireApostleCommand, DesireApostleProjection } from "../../src/domain/desire-apostle/types";
import type { DemonProjection } from "../../src/domain/demon/types";
import { DesireApostleDemonHistory, DesireApostlePanel } from "../../src/renderer/DesireApostlePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；恶魔消化100且晋升后满12整周，健康须大于20、精神须大于40。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。原瓶耗用，指导保护不适用于战斗。";
function action(command: DesireApostleCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): DesireApostleAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取欲望使徒成品用药指导", true, "460便士 · 1行动");
function apostle(patch: Partial<DesireApostleProjection> = {}): DesireApostleProjection {
  return {
    title: "欲望使徒晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "恶魔扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, ...patch,
  };
}
function cases(): DesireApostleProjection["cases"] {
  return [
    { id: "calm-boundary", title: "平稳时的边界", story: "成年蕾娜在原室自愿有限讨论，当前心情平稳；同一原账簿DA5-LEDGER-1由指导者保管。" },
    { id: "eager-rehearsal", title: "米蕾尔的自愿排练", story: "成年米蕾尔因自选舞台排练兴奋，本人明确同意一次有限试验。" },
    { id: "honest-account", title: "同一原纸的如实记录", story: "在DA5-NOTE-1上写已有公开事实，失败也保留已写文字。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalPractice: NonNullable<DesireApostleProjection["practice"]> = {
  emotion: "当前原室心情平稳；未开始米蕾尔的本次排练。",
  seed: "尚无本次待用种子，未发生催化停顿。",
  records: "原账簿DA5-LEDGER-1在指导者处；原纸DA5-NOTE-1尚未写入。",
  history: [],
};
function bottled(): DesireApostleProjection {
  const originals = [
    { id: "desire-apostle-potion-1", title: "第一瓶欲望使徒魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "desire-apostle-potion-2", title: "第二瓶欲望使徒魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "desire-apostle-potion-3", title: "第三瓶欲望使徒魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return apostle({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): DesireApostleProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const planted = "本次实际埋种成功，已付1行动与3灵性；种子仍待催化，没有催化结果。";
const close = action({ type: "CLOSE", caseId: "eager-rehearsal" }, "停止本次自愿试验并等过有限窗口", true, "0行动 · 0精神 · 0灵性");
function pending(enabled = true): DesireApostleProjection {
  const catalyze = action({ type: "CATALYZE", caseId: "eager-rehearsal" }, "催化本次实际种子", enabled, "0额外行动 · 2灵性 · 知识14");
  if (!enabled) catalyze.reason = "本次催化还需要2灵性；可以免费结束本次试验。";
  return apostle({ promoted: true, insideCase: true, actions: [catalyze, close], cases: cases().map((entry) => entry.id === "eager-rehearsal" ? {
    ...entry, status: "PREPARED", preparation: null, observations: [planted], contactOpen: "本次实际接触尚未结束",
  } : entry), practice: { ...originalPractice, emotion: "米蕾尔本人明确说期待登台，当前可见表现激动。", seed: planted, history: [planted] } });
}
function panel(value: DesireApostleProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<DesireApostlePanel desireApostle={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Desire Apostle public conditions, two paid phases and independent original bottles", () => {
  it("shows the S6 gate and G source without inventing a full recipe or ritual", () => {
    const reason = "恶魔扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原瓶已完成4/5步劳务，原价4800便士；新批次须实际跨周到货。";
    const { onCommand } = panel(apostle({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "欲望使徒成长下一步" });
    for (const text of ["恶魔6 → 欲望使徒5", reason, "完整魔药配方与晋升仪式细节尚未核实", "不能据此断言无需仪式", "460便士", "4800便士", "600便士"])
      expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取欲望使徒成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards guidance, original-specific labour and payment, and actual resupply with projected costs", async () => {
    const commands: DesireApostleCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "desire-apostle-potion-3" },
      { type: "BUY_POTION", bottleId: "desire-apostle-potion-3" }, { type: "BUY_POTION", bottleId: "desire-apostle-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(apostle({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each independently identified bottle with keyboard focus restored and zero AP spent", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["desire-apostle-potion-1", "desire-apostle-potion-2", "desire-apostle-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3"); expect(screen.getByText(id)).toBeTruthy();
      if (id === "desire-apostle-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only this original's source, chance, Will26 risk and resources before one exact confirmation", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("desire-apostle-potion-2"));
    expect(screen.getByText("desire-apostle-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "欲望使徒服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶欲望使徒魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command); expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains a submitted original through save failure without another consumption or local retry", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("desire-apostle-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欲望使徒魔药」" }));
    const error = { message: "服药尚未保存，请重试同一操作。", retryable: true };
    rerender(<DesireApostlePanel desireApostle={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欲望使徒魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("desire-apostle-potion-1")).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DesireApostlePanel desireApostle={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<DesireApostlePanel desireApostle={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶欲望使徒魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves a committed failed bottle and confirms another original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("desire-apostle-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欲望使徒魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<DesireApostlePanel desireApostle={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*desire-apostle-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("desire-apostle-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶欲望使徒魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only after committed promotion, preserving all bottle identities and sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("desire-apostle-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶欲望使徒魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升欲望使徒" } : bottle) };
    rerender(<DesireApostlePanel desireApostle={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶欲望使徒魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "欲望使徒能力与消化" })).toBeTruthy();
    for (const bottle of value.bottles) { expect(screen.getByText(`原瓶ID：${bottle.id}`)).toBeTruthy(); expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy(); }
    expect(screen.getByText("原瓶已耗用 · 已晋升欲望使徒")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles, updates eligibility and removes revoked confirmations", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value); await userEvent.click(bottleButton("desire-apostle-potion-2"));
    expect(screen.getByText("desire-apostle-potion-2")).toBeTruthy();
    const updated = { ...value, risk: "更新后的公开四档风险。", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "请先恢复精神。" })) };
    rerender(<DesireApostlePanel desireApostle={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「独立原瓶」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    rerender(<DesireApostlePanel desireApostle={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶欲望使徒魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents only CATALYZE and CLOSE for the paid PREPARED seed, with no accidental PERFORM or WITHDRAW", async () => {
    const value = pending(); value.actions.push(
      action({ type: "PERFORM", caseId: "eager-rehearsal" }, "不可重复埋种"),
      action({ type: "WITHDRAW", caseId: "eager-rehearsal" }, "不可把已埋种当未开始撤回"),
      action({ type: "REPORT", caseId: "eager-rehearsal" }, "不可提前报告"),
      action({ type: "PREPARE", caseId: "calm-boundary", method: "ORDINARY" }, "不可改做另一案"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前开战"));
    const { onCommand } = panel(value, vi.fn(), { ...resources, spirituality: 2 });
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("eager-rehearsal"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(2);
    const current = screen.getByRole("region", { name: "当前欲望使徒实践" });
    expect(current.textContent).toContain("已实际埋种，尚未催化"); expect(current.textContent).not.toContain("尚未实际执行");
    expect(current.textContent).toContain("本次准备已经实际执行并成功埋种"); expect(current.textContent).not.toContain("当前没有待执行的实践");
    const notice = screen.getByRole("region", { name: "待处理的实际种子" });
    for (const text of ["已实际支付1行动与3灵性", "另付2灵性、0额外行动", "失败仍消耗这2灵性", "尚未获得催化结果或报告奖励", "0行动、0精神、0灵性结束", "单次有限窗口", "不代表全局净化能力"])
      expect(notice.textContent).toContain(text);
    const catalyze = screen.getByRole("button", { name: /^催化本次实际种子/ }) as HTMLButtonElement;
    expect(catalyze.disabled).toBe(false); expect(catalyze.textContent).toContain("0额外行动 · 2灵性 · 知识14");
    await userEvent.click(catalyze); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(screen.getByRole("region", { name: "待处理的实际种子" })).toBeTruthy();
    expect(screen.getAllByText(planted)).toHaveLength(3);
  });

  it("keeps CLOSE usable at zero AP, mind and S while disabled catalysis explains the missing 2S", async () => {
    const value = pending(false); const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    const catalyze = screen.getByRole("button", { name: /^催化本次实际种子/ }) as HTMLButtonElement;
    expect(catalyze.disabled).toBe(true); fireEvent.click(catalyze);
    expect(screen.getByText("本次催化还需要2灵性；可以免费结束本次试验。")).toBeTruthy();
    const stop = screen.getByRole("button", { name: /^停止本次自愿试验并等过有限窗口/ }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false); expect(stop.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(stop); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
    expect(screen.getByRole("region", { name: "待处理的实际种子" })).toBeTruthy();
    const expired = "实际结束本次约定并等过窗口；种子已到期，原3灵性不退还，米蕾尔仍在原室。";
    rerender(<DesireApostlePanel desireApostle={{ ...value, insideCase: false, actions: [], practice: { ...originalPractice, seed: expired, history: [planted, expired] } }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "待处理的实际种子" })).toBeNull(); expect(screen.getAllByText(expired)).toHaveLength(2);
    expect(screen.getAllByText(planted)).toHaveLength(2); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
  });

  it("uses the pending public intent even without practice prose and does not invent a second cast", () => {
    const value = { ...pending(false), practice: null, insideCase: false }; const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "待处理的实际种子" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2); expect(screen.queryByRole("button", { name: /撤回|执行|埋种/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps genuinely unstarted PREPARED execution and withdrawal distinct from a paid seed", async () => {
    const perform = action({ type: "PERFORM", caseId: "eager-rehearsal" }, "实际尝试埋种", true, "1行动 · 3灵性 · 知识14");
    const withdraw = action({ type: "WITHDRAW", caseId: "eager-rehearsal" }, "撤回尚未开始的准备", true, "0行动 · 0灵性");
    const value = apostle({ promoted: true, cases: cases().map((entry) => entry.id === "eager-rehearsal" ? { ...entry, status: "PREPARED" } : entry),
      practice: originalPractice, actions: [perform, withdraw] });
    const { onCommand } = panel(value, vi.fn(), { ...resources, actionsRemaining: 1, spirituality: 3 });
    expect(screen.queryByRole("region", { name: "待处理的实际种子" })).toBeNull();
    expect(screen.getByRole("region", { name: "当前欲望使徒实践" }).textContent).toContain("开始前建议至少5灵性");
    expect(screen.queryByRole("button", { name: /催化/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未开始的准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(screen.getByText(originalPractice.seed)).toBeTruthy();
  });

  it.each(["calm-boundary", "honest-account"])("offers only ordinary preparation for %s, with no fabricated ability control", async (caseId) => {
    const ordinary = action({ type: "PREPARE", caseId, method: "ORDINARY" }, "准备本次普通核对", true, "1行动 · 0灵性");
    const value = apostle({ promoted: true, cases: cases(), practice: originalPractice, actions: [ordinary,
      action({ type: "PREPARE", caseId, method: "ABILITY" }, "不可强制情绪或读取思想")] });
    const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(caseId);
    expect(screen.queryByRole("button", { name: /强制|思想|催化|埋种/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前欲望使徒实践" }).textContent).toContain(caseId === "calm-boundary" ? "入口不成立" : "失败保留");
    await userEvent.click(screen.getByRole("button", { name: /^准备本次普通核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(screen.getByText(originalPractice.seed)).toBeTruthy();
  });

  it.each(["calm-boundary", "eager-rehearsal", "honest-account"])("keeps the actual %s exit usable and retains actual originals until committed close", async (caseId) => {
    const exit = action({ type: "CLOSE", caseId }, "实际返还原物并结束接触", true, "0行动 · 0精神 · 0灵性");
    const stale = action({ type: "CLOSE", caseId: caseId === "calm-boundary" ? "honest-account" : "calm-boundary" }, "旧接触不可再关", false);
    const records = "原账簿在本人手中；同一原纸已有失败文字，仍未交回。";
    const value = apostle({ promoted: true, insideCase: true, cases: cases(), practice: { ...originalPractice, records }, actions: [stale, exit,
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前离场交涉")] });
    const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, mind: 0, spirituality: 0 });
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const button = screen.getByRole("button", { name: /^实际返还原物并结束接触/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); await userEvent.click(button);
    expect(screen.getByText(records)).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(exit.command);
    const returned = "同一原账簿已实际返还指导者，同一已写原纸已交回；原失败文字保留。";
    rerender(<DesireApostlePanel desireApostle={{ ...value, insideCase: false, actions: [], practice: { ...originalPractice, records: returned, history: [records, returned] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getAllByText(returned)).toHaveLength(2); expect(screen.getByText(records)).toBeTruthy();
  });

  it("renders paid catalysis failure and spent seed without a fake success, refund, report or mastery gain", async () => {
    const failed = "实际催化失败，已付2灵性；种子已耗去，未出现约定停顿，不能报告成功。";
    const abilities = [{ id: "abyss.s5.catalysis", label: "有限催化", mastery: 0, description: "没有成功催化报告。" }];
    const value = pending(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^催化本次实际种子/ }));
    const committed = { ...value, abilities, actions: [close], practice: { ...value.practice!, seed: failed, history: [planted, failed] },
      cases: value.cases.map((entry) => entry.id === "eager-rehearsal" ? { ...entry, status: "OBSERVED", result: failed } : entry) };
    rerender(<DesireApostlePanel desireApostle={committed} resources={{ ...resources, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "待处理的实际种子" })).toBeNull(); expect(screen.getAllByText(failed)).toHaveLength(3);
    expect(screen.getByText("有限催化 · 掌握 0")).toBeTruthy(); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /报告|重新埋种|催化本次/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^停止本次自愿试验并等过有限窗口/ }));
    expect(screen.getAllByText(failed)).toHaveLength(3); expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, close.command]);
  });

  it("shows a successful bounded pause only from committed projection, then forwards the exact closed report", async () => {
    const value = pending(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^催化本次实际种子/ }));
    const observed = "本次实际催化成功；米蕾尔出现一次约定的短暂可见停顿，仍在原室，未交出任何秘密。";
    expect(screen.queryByText(observed)).toBeNull();
    const committed = { ...value, actions: [close], practice: { ...value.practice!, seed: observed, history: [planted, observed] } };
    rerender(<DesireApostlePanel desireApostle={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getAllByText(observed)).toHaveLength(2); await userEvent.click(screen.getByRole("button", { name: /^停止本次自愿试验并等过有限窗口/ }));
    const report = action({ type: "REPORT", caseId: "eager-rehearsal" }, "提交本次已结束的有限催化报告", true, "1行动 · 25扮演 · 实际成功能力报告8知识池");
    rerender(<DesireApostlePanel desireApostle={{ ...committed, insideCase: false, actions: [report] }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^提交本次已结束的有限催化报告/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, close.command, report.command]);
    expect((screen.getByRole("progressbar") as HTMLProgressElement).value).toBe(0);
  });

  it("never infers a pending seed or hidden mind from extras, historical words, or absent public practice", () => {
    const value = { ...apostle({ promoted: true, cases: cases(), actions: [], practice: null, story: "历史文字提到PLANTED、PREPARED和催化，不是当前状态。" }),
      secretThought: "SECRET_THOUGHT", memory: "SECRET_MEMORY", nextRoll: "SECRET_ROLL", privateDesire: "SECRET_DESIRE" };
    const { container, onCommand, rerender } = panel(value);
    for (const secret of [value.secretThought, value.memory, value.nextRoll, value.privateDesire]) expect(container.textContent).not.toContain(secret);
    expect(screen.queryByRole("region", { name: "待处理的实际种子" })).toBeNull();
    expect(screen.queryByRole("region", { name: "已保存的公开情绪、种子与原记录" })).toBeNull();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    rerender(<DesireApostlePanel desireApostle={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "欲望使徒成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks all pending mutations and selection during busy, external block or save error without changing the seed", () => {
    const value = pending(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "催化保存失败", retryable: true } }]) {
      rerender(<DesireApostlePanel desireApostle={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByRole("region", { name: "待处理的实际种子" })).toBeTruthy(); expect(screen.getAllByText(planted)).toHaveLength(3);
    }
    rerender(<DesireApostlePanel desireApostle={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains ordinary peaceful100, actual masteries and bounded Ferran choices without introducing S4", async () => {
    const abilities = [{ id: "abyss.s5.emotion-seed", label: "情绪种子", mastery: 0, description: "尚无实际能力掌握。" },
      { id: "abyss.s5.catalysis", label: "有限催化", mastery: 0, description: "普通路线未伪增掌握。" },
      { id: "abyss.s6.flame-hex", label: "原恶魔火焰", mastery: 17, description: "原能力掌握保留。" }];
    const talk = action({ type: "ENCOUNTER_TALK" }, "与费兰实际交涉"); const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担费兰冲突");
    const { onCommand } = panel(apostle({ promoted: true, acting: 100, digestion: "本阶段已消化", abilities, actions: [talk, fight] }));
    expect((screen.getByRole("progressbar", { name: "欲望使徒扮演进度" }) as HTMLProgressElement).value).toBe(100);
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("欲望使徒能力边界");
    for (const text of ["强烈情绪波动或明显欲望", "情绪平稳、欲望内敛", "第一、第三项只提供普通方法", "全部采用普通方法也可完成", "8点知识池掌握", "无风险完美扮演", "两回合窗口", "序列4魔鬼尚未开放", "个体燃角激化或舍身留影"])
      expect(boundary.textContent).toContain(text);
    const encounter = screen.getByRole("region", { name: "欲望使徒有限冲突" });
    for (const text of ["成年看守费兰", "自己的普通短棍", "日光空院", "对方不追击", "寻找空当", "一旦平稳", "受伤不会自动使他再度愤怒"])
      expect(encounter.textContent).toContain(text);
    await userEvent.click(within(encounter).getByRole("button", { name: /^与费兰实际交涉/ }));
    await userEvent.click(within(encounter).getByRole("button", { name: /^承担费兰冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /读心|烧角|留影|魔鬼|秒杀/ })).toBeNull();
  });

  it("keeps old Demon stories, body, flame, strain, failures, bottles and abilities fully read-only", () => {
    const demon: DemonProjection = {
      title: "恶魔", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      story: "原恶魔故事与实际失败。", environment: "原莫顿已重伤投降，真实结果保留。", supplies: "原独立瓶供给与真实耗用。",
      acting: 100, digestion: "已消化", pollution: 4, risk: "原恶魔意志24四档风险。", insideCase: false, strain: 2, practice: { body: "NORMAL", flame: "EXTINGUISHED" },
      actions: [{ id: "old-reflect", label: "不可重做旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: [{ id: "cold-brazier", title: "原冷火盆", story: "第一次点火失败仍实际耗灵。", status: "RESOLVED", observations: ["同一原火盆已盖熄，原靶灼痕保留。"],
        preparation: "使用原盖并保留实际退路。", result: "后来完成有限报告，第一次失败保留。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "demon-old-1", title: "恶魔旧原瓶", source: "原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "demon-old-1", confirmed: true } }],
      abilities: [{ id: "abyss.s6.demonic-body", label: "原魔化身体", mastery: 17, description: "原真实身体实践掌握。" }],
    };
    render(<DesireApostleDemonHistory demon={demon} />);
    const history = within(screen.getByRole("region", { name: "恶魔时期的经历" }));
    for (const text of ["原恶魔故事与实际失败。", "原莫顿已重伤投降，真实结果保留。", "2 / 3", "正常身体", "同一原火盆已实际盖熄", "原恶魔意志24四档风险。",
      "第一次点火失败仍实际耗灵。", "原案卷ID：cold-brazier", "同一原火盆已盖熄，原靶灼痕保留。", "当时的方式与准备：使用原盖并保留实际退路。",
      "当时的实际结果与报告：后来完成有限报告，第一次失败保留。", "原瓶ID：demon-old-1", "来源：原独立成品渠道", "已耗用 · 原失败保留", "原魔化身体 · 掌握 17：原真实身体实践掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByText("不可重做旧成长")).toBeNull(); expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
