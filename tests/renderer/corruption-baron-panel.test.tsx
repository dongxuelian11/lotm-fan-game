/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CorruptionBaronAction, CorruptionBaronCommand, CorruptionBaronProjection } from "../../src/domain/corruption-baron/types";
import type { BriberProjection } from "../../src/domain/briber/types";
import { CorruptionBaronPanel, CorruptionBaronBriberHistory } from "../../src/renderer/CorruptionBaronPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: CorruptionBaronCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): CorruptionBaronAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取腐化男爵成品用药指导", true, "360便士 · 1行动");
function corruptionBaron(patch: Partial<CorruptionBaronProjection> = {}): CorruptionBaronProjection {
  return {
    title: "腐化男爵晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "贿赂者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: { clauseOrder: "ORIGINAL", marker: "CRADLED", route: "READY" }, gifts: { held: 2, given: 4, summary: "原木筹1至4已实际给出，原木筹5与6仍持有。" }, ...patch,
  };
}
function cases(): CorruptionBaronProjection["cases"] {
  return [
    { id: "clause-order", title: "原条款的先后次序", story: "只偏转已说出口的有限条款，不改写原文字或凭空创造条款。" },
    { id: "rolling-marker", title: "同一原木球的滚动", story: "只处理原托槽中同一原木球的已有运动，原侧袋与挡板均保留。" },
    { id: "agreed-route", title: "原约定的递送路线", story: "成年递送员已有明确路线与递送意图，短暂影响可以失败或被本人抵抗。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): CorruptionBaronProjection {
  const originals = [
    { id: "corruption-baron-potion-1", title: "第一瓶腐化男爵魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "corruption-baron-potion-2", title: "第二瓶腐化男爵魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "corruption-baron-potion-3", title: "第三瓶腐化男爵魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return corruptionBaron({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "原判断失败，已经支付的灵性与本次风险保留。";
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(caseId = "rolling-marker", practice: CorruptionBaronProjection["practice"] = { clauseOrder: "ORIGINAL", marker: "SIDE_POCKET", route: "READY" }): CorruptionBaronProjection {
  return corruptionBaron({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本次实际结果已记录，现场仍需实际收束。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "结束本次实践，回到生活", true, zeroClose)],
  });
}
function panel(value: CorruptionBaronProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CorruptionBaronPanel corruptionBaron={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("CorruptionBaron public practice and saved original intent", () => {
  it("shows S7 maturity, G prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "贿赂者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(corruptionBaron({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "腐化男爵成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "不提供完整晋升配方、材料与剂量"])
      expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取腐化男爵成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: CorruptionBaronCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "corruption-baron-potion-3" },
      { type: "BUY_POTION", bottleId: "corruption-baron-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(corruptionBaron({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /^查看并准备服用「第一瓶腐化男爵魔药」/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶腐化男爵魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶腐化男爵魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶腐化男爵魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶腐化男爵魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶腐化男爵魔药」/ }));
    expect(screen.getByText("corruption-baron-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "腐化男爵服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶腐化男爵魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "corruption-baron-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶腐化男爵魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶腐化男爵魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<CorruptionBaronPanel corruptionBaron={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶腐化男爵魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("corruption-baron-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<CorruptionBaronPanel corruptionBaron={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<CorruptionBaronPanel corruptionBaron={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶腐化男爵魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶腐化男爵魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶腐化男爵魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<CorruptionBaronPanel corruptionBaron={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^查看并准备服用「第一瓶腐化男爵魔药」/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶腐化男爵魔药」/ }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("corruption-baron-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶腐化男爵魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶腐化男爵魔药」" }));
    const promoted = { ...value, title: "腐化男爵", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升腐化男爵" } : bottle) };
    rerender(<CorruptionBaronPanel corruptionBaron={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶腐化男爵魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升腐化男爵")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes same-title original bottles and submits the selected stable ID only once", async () => {
    const value = bottled();
    value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "腐化男爵成品魔药" }));
    const { onCommand } = panel(value);
    const second = screen.getByRole("button", { name: "查看并准备服用「腐化男爵成品魔药」 · 原瓶 corruption-baron-potion-2" });
    await userEvent.click(second);
    expect(screen.getByText("corruption-baron-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.queryByText("corruption-baron-potion-1")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「腐化男爵成品魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "corruption-baron-potion-2", confirmed: true });
  });

  it("renders all three original scenes and forwards only projected methods without early results", async () => {
    const commands: CorruptionBaronCommand[] = [
      { type: "OBSERVE", caseId: "clause-order" }, { type: "PREPARE", caseId: "clause-order", method: "ORDINARY" },
      { type: "PREPARE", caseId: "clause-order", method: "ABILITY" }, { type: "PERFORM", caseId: "clause-order" },
      { type: "WITHDRAW", caseId: "clause-order" }, { type: "REPORT", caseId: "clause-order" },
    ];
    const labels = ["核对已有原说法", "准备普通复核", "准备一次有限扭曲", "实际执行本次方法", "取消本次准备", "提交有限报告"];
    const { onCommand } = panel(corruptionBaron({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "腐化男爵实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "clause-order");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前改动原条款、使原木球滚动或改变递送员的行动意图");
    expect(screen.getByText("当前原条款：原核册次序仍在")).toBeTruthy();
    expect(screen.getByText("当前原木球：同一原木球仍在原托槽中")).toBeTruthy();
    expect(screen.getByText("当前递送路线：原约定路线仍在，尚未开始本次递送")).toBeTruthy();
  });

  it("honors ability costs and shortage reasons while retaining the ordinary route", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "clause-order", method: "ABILITY" }, "准备有限扭曲", false, "1行动 · 执行需3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "clause-order", method: "ORDINARY" }, "准备普通条款复核", true, "1行动 · 0灵性");
    const { onCommand } = panel(corruptionBaron({ promoted: true, cases: cases(), actions: [ability, ordinary] }));
    const abilityButton = screen.getByRole("button", { name: /^准备有限扭曲/ }) as HTMLButtonElement;
    expect(abilityButton.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy();
    expect(abilityButton.getAttribute("aria-describedby")).toBe(`corruptionBaron-reason-${ability.id}`);
    expect(screen.getByText(ability.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    fireEvent.click(abilityButton); await userEvent.click(screen.getByRole("button", { name: /^准备普通条款复核/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("region", { name: "腐化男爵实际结果" })).toBeNull();
  });

  it.each([
    { caseId: "clause-order", practice: { clauseOrder: "ADJUSTED", marker: "CRADLED", route: "READY" } },
    { caseId: "rolling-marker", practice: { clauseOrder: "ORIGINAL", marker: "SIDE_POCKET", route: "READY" } },
    { caseId: "agreed-route", practice: { clauseOrder: "ORIGINAL", marker: "CRADLED", route: "DIVERTED" } },
  ] as { caseId: string; practice: CorruptionBaronProjection["practice"] }[])("pins the active $caseId scene to its zero-cost CLOSE even at zero resources", async ({ caseId, practice }) => {
    const { onCommand, rerender } = panel(corruptionBaron({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "clause-order" ? "rolling-marker" : "clause-order";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId, practice);
    rerender(<CorruptionBaronPanel corruptionBaron={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧场景不能结束本次实践", false), ...value.actions,
      action({ type: "REPORT", caseId }, "不可提前报告"), action({ type: "WITHDRAW", caseId }, "不可撤回代替结束"),
      action({ type: "PREPARE", caseId, method: "ORDINARY" }, "不可提前重置原物"),
      action({ type: "BUY_GIFTS" }, "不可接触中买赠物"), action({ type: "REFLECT" }, "不可提前反思"),
      action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束本次实践，回到生活/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose);
    await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
    expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "腐化男爵成长下一步" }).textContent).toContain("先结束本次实践，回到生活");
  });

  it.each([
    { caseId: "clause-order", field: "clauseOrder", before: "PENDING", after: "RESTORED", oldText: "当前原条款：正在按原安排核查，尚未收束", newText: "当前原条款：原核册次序已实际恢复" },
    { caseId: "clause-order", field: "clauseOrder", before: "ADJUSTED", after: "RESTORED", oldText: "当前原条款：两份原册的核查先后已临时调整，尚未恢复", newText: "当前原条款：原核册次序已实际恢复" },
    { caseId: "rolling-marker", field: "marker", before: "ROLLING", after: "STOPPED", oldText: "当前原木球：同一原木球正在滚动，尚未收停", newText: "当前原木球：同一原木球已实际收停" },
    { caseId: "rolling-marker", field: "marker", before: "SIDE_POCKET", after: "STOPPED", oldText: "当前原木球：同一原木球已偏入原侧袋，尚未收回", newText: "当前原木球：同一原木球已实际收停" },
    { caseId: "agreed-route", field: "route", before: "MOVING", after: "FREE", oldText: "当前递送路线：递送员正在沿原约定路线行走，尚未结束", newText: "当前递送路线：本次递送实践已结束，递送员可自由离开" },
    { caseId: "agreed-route", field: "route", before: "DIVERTED", after: "FREE", oldText: "当前递送路线：递送员已走上原侧路，本次实践尚未结束", newText: "当前递送路线：本次递送实践已结束，递送员可自由离开" },
  ])("keeps $field $before and failure visible until saved actual closure", async ({ caseId, field, before, after, oldText, newText }) => {
    const practice = { ...corruptionBaron().practice, [field]: before } as CorruptionBaronProjection["practice"];
    const value = opened(caseId, practice); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(oldText)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^结束本次实践，回到生活/ }));
    expect(screen.getByText(oldText)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    rerender(<CorruptionBaronPanel corruptionBaron={{ ...value, insideCase: false, actions: [], practice: { ...practice, [field]: after },
      cases: value.cases.map((entry) => entry.id === caseId ? { ...entry, closes: 1, contactOpen: "已实际结束本次实践" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(newText)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
  });

  it("keeps ordinary consent and movement separate from a claimed supernatural effect", () => {
    const value = opened("agreed-route", { clauseOrder: "RESTORED", marker: "STOPPED", route: "DIVERTED" });
    value.cases = value.cases.map((entry) => entry.id === "agreed-route" ? { ...entry, result: "赛恩自行采纳普通建议；本次使用普通方法，没有施加扭曲。" } : entry);
    panel(value);
    expect(screen.getByText("当前递送路线：递送员已走上原侧路，本次实践尚未结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "腐化男爵实际结果" }).textContent).toContain("本次使用普通方法，没有施加扭曲");
    expect(screen.queryByText("当前递送路线：本次已有行动意图短暂偏转，尚未解除")).toBeNull();
  });

  it("does not manufacture an exit, report or restored state from historical prose", () => {
    const value = { ...opened(), actions: [], cases: cases().map((entry) => ({ ...entry, result: "上次原球已收好，本次仍需实际处理。" })) };
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "腐化男爵成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.getByText("当前原木球：同一原木球已偏入原侧袋，尚未收回")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards BUY_GIFTS without optimistically replenishing the inherited original stock", async () => {
    const buy = action({ type: "BUY_GIFTS" }, "购买三枚原木筹", true, "60便士 · 0行动");
    const value = corruptionBaron({ promoted: true, actions: [buy] });
    const { onCommand, rerender } = panel(value);
    const gifts = screen.getByRole("region", { name: "继承贿赂的原赠物" });
    expect(gifts.textContent).toContain("当前持有 2 件 · 已实际给出 4 件");
    expect(gifts.textContent).toContain("原木筹1至4已实际给出，原木筹5与6仍持有。");
    expect(screen.getByText(buy.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^购买三枚原木筹/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_GIFTS" });
    expect(gifts.textContent).toContain("当前持有 2 件 · 已实际给出 4 件");
    rerender(<CorruptionBaronPanel corruptionBaron={{ ...value, gifts: { held: 5, given: 4, summary: "旧六枚去向保留，新增原木筹7至9实际取得。" } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前持有 5 件 · 已实际给出 4 件")).toBeTruthy();
    expect(screen.getByText("旧六枚去向保留，新增原木筹7至9实际取得。")).toBeTruthy();
  });

  it("locks pending selection and mutations while retaining committed facts", () => {
    const value = corruptionBaron({ promoted: true, cases: cases(), practice: { clauseOrder: "RESTORED", marker: "STOPPED", route: "FREE" }, actions: [
      action({ type: "OBSERVE", caseId: "clause-order" }, "观察已有条款"), action({ type: "BUY_GIFTS" }, "购买原赠物"),
      action({ type: "REFLECT" }, "反思原报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<CorruptionBaronPanel corruptionBaron={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("当前原木球：同一原木球已实际收停")).toBeTruthy();
      expect(screen.getByText("当前递送路线：本次递送实践已结束，递送员可自由离开")).toBeTruthy();
    }
    rerender(<CorruptionBaronPanel corruptionBaron={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows six inherited mastery records plus distortion and keeps the higher-sequence boundary explicit", () => {
    const ids = ["black-emperor.s9.rule-analysis", "black-emperor.s9.persuasive-argument", "black-emperor.s9.weak-point-insight", "black-emperor.s8.enhanced-body", "black-emperor.s8.mental-resistance", "black-emperor.s7.bribery-weakening", "black-emperor.s6.distortion"];
    const labels = ["规则分析", "说服", "弱点观察", "增强身体", "有限精神抵抗", "贿赂削弱", "扭曲"];
    const abilities = ids.map((id, index) => ({ id, label: labels[index]!, mastery: index + 10, description: `保留第${index + 1}项已知能力实际掌握。` }));
    const story = "扭曲能力以核实原文为边界，三段情境与和平路线为G原创。";
    panel(corruptionBaron({ promoted: true, story, cases: cases(), actions: [], abilities }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 7 项训练记录" })).toBeTruthy();
    for (const ability of abilities) {
      expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(screen.getByText(ability.description)).toBeTruthy();
    }
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看有限扭曲与继承能力边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["本序列只新增扭曲", "已经存在的语言、行动或意图", "短暂", "可能失败或被抵抗", "不是长期控制", "同一原木球", "自由离开", "真实原赠物", "序列5混乱", "序列4放大、利用", "普通方法保留", "结束实践0行动、0精神、0灵性", "原著无代价保证"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never exposes private source fields or treats a hidden intent as an available action", () => {
    const value = { ...corruptionBaron({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "clause-order" }, "核对当前条款")] }),
      privatePlan: "PRIVATE_PLAN_NEVER_RENDER", future: "FUTURE_ROLL_NEVER_RENDER", hiddenIntention: "SECRET_INTENT_NEVER_RENDER", giftPool: 999 };
    panel(value);
    for (const secret of ["PRIVATE_PLAN_NEVER_RENDER", "FUTURE_ROLL_NEVER_RENDER", "SECRET_INTENT_NEVER_RENDER", "999"])
      expect(document.body.textContent).not.toContain(secret);
    expect(screen.queryByRole("region", { name: "腐化男爵实际结果" })).toBeNull(); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /长期控制|强迫服从|改写记忆|发动混乱|放大|利用期限/ })).toBeNull();
  });

  it("forwards encounter choices while keeping actual exit and injury risks visible", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "澄清原场地争议"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(corruptionBaron({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "原对手和自己的普通短棍仍在原外院。", actions }));
    expect(screen.getByRole("progressbar", { name: "腐化男爵扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = within(screen.getByRole("region", { name: "腐化男爵有限冲突" }));
    for (const text of ["已有出口", "实际退出", "这里不追击", "可能失败或被抵抗", "真实伤势"])
      expect(encounter.getByText(/只按当前公开现场交涉或承担冲突/).textContent).toContain(text);
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("retains old bribery choices, gifts, material uncertainty, failures and bottles as read-only history", () => {
    const briber: BriberProjection = {
      title: "贿赂者", discovered: true, promoted: true, formulaKnown: true,
      formula: [{ name: "怪脸大麻结晶", quantity: null, unit: "", note: "原供货一份仅为G适配。" }],
      supplies: "原贿赂者供给记录保留。", story: "原贿赂者故事。", environment: "原赠与现场已经实际结束。",
      cases: [{ id: "rejected-cup", title: "当事人的原拒绝", story: "对方仍拒绝喝下原杯中水，不把拒绝改写为同意。", status: "RESOLVED", observations: ["原木筹4已实际给出。"],
        preparation: "只记录一个实际后续动作。", result: "无合格后续动作，原效果已过期且不退筹。", contactOpen: "已实际结束原接触", closes: 2 }],
      actions: [{ id: "old-gifts", label: "不可在旧历史中购买赠物", enabled: true, reason: null, cost: "60便士", command: { type: "BUY_GIFTS" } }],
      bottles: [{ id: "briber-original-1", title: "贿赂者旧原瓶", source: "独立贿赂者原批六料", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "briber-original-1", confirmed: true } }],
      abilities: [{ id: "black-emperor.s7.bribery-weakening", label: "原贿赂削弱", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      gifts: { held: 2, given: 4, summary: "旧原木筹1至4已给出，原木筹5和6仍在。" },
    };
    render(<CorruptionBaronBriberHistory briber={briber} />);
    const history = within(screen.getByRole("region", { name: "贿赂者时期的经历" }));
    for (const text of ["原贿赂者故事。", "原贿赂者供给记录保留。", "对方仍拒绝喝下原杯中水，不把拒绝改写为同意。", "原木筹4已实际给出。", "原案卷ID：rejected-cup", "原瓶ID：briber-original-1",
      "当时的方式与准备：只记录一个实际后续动作。", "当时的接触：已实际结束原接触", "当时实际结束次数：2", "当时的实际结果与报告：无合格后续动作，原效果已过期且不退筹。", "来源：独立贿赂者原批六料", "已耗用 · 原失败保留", "原贿赂削弱 · 掌握 67：保留原能力实际掌握。", "旧原木筹1至4已给出，原木筹5和6仍在。", "现仍持有 2 件原赠物 · 已实际给出 4 件"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/怪脸大麻结晶 · 数量原文未注明/)).toBeTruthy();
    expect(history.getByText("原供货一份仅为G适配。")).toBeTruthy();
    expect(history.getByText(/你已晋升腐化男爵（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可在旧历史中购买赠物")).toBeNull();
    for (const details of screen.getByRole("region", { name: "贿赂者时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
