/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DawnPaladinAction, DawnPaladinCommand, DawnPaladinProjection } from "../../src/domain/dawn-paladin/types";
import type { WeaponmasterProjection } from "../../src/domain/weaponmaster/types";
import { DawnPaladinPanel, DawnPaladinWeaponmasterHistory } from "../../src/renderer/DawnPaladinPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections test UI intent handling, never domain outcomes.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "大成功与成功可晋升；失败与灾难消耗这一原瓶，排异、污染与伤势按实际结果保留。";
function action(command: DawnPaladinCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): DawnPaladinAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取黎明骑士成品用药指导", true, "1行动 · 公开指导费");
function dawn(patch: Partial<DawnPaladinProjection> = {}): DawnPaladinProjection {
  return {
    title: "黎明骑士晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "武器大师扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: {
      swordActive: false, armorActive: false, illusionCreated: false, volunteerSpirituality: 20, illusionDispelled: false, screenRemoved: false,
      armorProbePerformed: false, armorCracked: false, stormCleared: false, instructorOutside: false,
      stormTarget: "INTACT", stormFrameScorched: false, stormSwordDispersed: false, stormArmorCracked: false,
    },
    battleEquipment: { swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null }, ...patch,
  };
}
function cases(): DawnPaladinProjection["cases"] {
  return [
    { id: "marked-exit", title: "原标记后的出口", story: "教学低位幻象遮住原出口，普通标记与退路仍须实际核对。" },
    { id: "armor-test", title: "有限铠甲试验", story: "原软垫和停止信号在场，铠甲可能在实际试探中破裂。" },
    { id: "cleared-storm", title: "清场后的原靶", story: "原靶位于练习场，须实际清场，光之风暴仍可能波及原靶框。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次实践", closes: 0 }));
}
function bottled(): DawnPaladinProjection {
  const originals = [
    { id: "dawn-paladin-potion-1", title: "第一瓶黎明骑士魔药", source: "原渠道第一瓶成品，独立劳务记录", chance: 71 },
    { id: "dawn-paladin-potion-2", title: "第二瓶黎明骑士魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "dawn-paladin-potion-3", title: "第三瓶黎明骑士魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return dawn({ guidanceKnown: true, supplies: "三瓶独立成品，逐瓶劳务与支付；当前第一瓶已取得。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): DawnPaladinProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "实际铠甲试探失败，铠甲破裂；原消耗与本次结果保留。";
function opened(): DawnPaladinProjection {
  return dawn({ promoted: true, insideCase: true,
    practice: { ...dawn().practice, armorProbePerformed: true, armorCracked: true },
    cases: cases().map((entry) => entry.id === "armor-test" ? {
      ...entry, status: "EXAMINED", observations: ["已核对原软垫与本人停止信号。", firstFailure],
      preparation: "准备本次有限铠甲试探。", result: "本次铠甲已破裂，须结束能力并实际离场。", contactOpen: "本次实践尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "armor-test" }, "结束铠甲试验并实际离场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: DawnPaladinProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DawnPaladinPanel dawnPaladin={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Dawn Paladin public practice, originals and actual departure", () => {
  it("shows the public S7 maturity gate and supply without inventing a complete formula", () => {
    const reason = "武器大师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原渠道保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(dawn({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "黎明骑士成长下一步" });
    for (const text of [reason, "先完成武器大师消化与成熟时间", "完整配方、材料与剂量尚未核实", "不开放材料采购或调配"]) expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取黎明骑士成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards guidance, per-original labour, payment and supply with exact public costs", async () => {
    const commands: DawnPaladinCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "dawn-paladin-potion-3" },
      { type: "BUY_POTION", bottleId: "dawn-paladin-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "RETURN_TOOL" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货", "实际归还原借棍"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "320便士 · 0行动", "1行动 · 下周到货", "0行动", "1行动 · 归还同一原物"];
    const { onCommand } = panel(dawn({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("offers three originals and cancels confirmation at zero AP with keyboard focus restored", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(3);
    screen.getByRole("button", { name: "查看并准备服用「第一瓶黎明骑士魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶黎明骑士魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶黎明骑士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶黎明骑士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶黎明骑士魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows source, four-tier risk and current resources before confirming the selected original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶黎明骑士魔药」" }));
    expect(screen.getByText("dawn-paladin-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "黎明骑士服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶黎明骑士魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "dawn-paladin-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "黎明骑士能力与消化" })).toBeNull();
  });

  it("uses newly projected risk, resources and eligibility while confirmation is open", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶黎明骑士魔药」" }));
    const reason = "当前精神不足，请先休养。";
    const updated = { ...value, risk: "当前污染已变化，四档结果按本次公开风险结算。", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 19 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<DawnPaladinPanel dawnPaladin={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶黎明骑士魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the submitted original on save failure and leaves same-intent retry to the parent", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶黎明骑士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶黎明骑士魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<DawnPaladinPanel dawnPaladin={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶黎明骑士魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("dawn-paladin-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<DawnPaladinPanel dawnPaladin={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original and independently offers the remaining originals", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶黎明骑士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶黎明骑士魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<DawnPaladinPanel dawnPaladin={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶黎明骑士魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶黎明骑士魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("dawn-paladin-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation after committed promotion while keeping the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶黎明骑士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶黎明骑士魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升黎明骑士" } : bottle) };
    rerender(<DawnPaladinPanel dawnPaladin={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶黎明骑士魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "黎明骑士能力与消化" })).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升黎明骑士")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("navigates three public cases and forwards actual methods without optimistic results", async () => {
    const commands: DawnPaladinCommand[] = [{ type: "OBSERVE", caseId: "marked-exit" }, { type: "PREPARE", caseId: "marked-exit", method: "ORDINARY" },
      { type: "PREPARE", caseId: "marked-exit", method: "ABILITY" }, { type: "PERFORM", caseId: "marked-exit" },
      { type: "WITHDRAW", caseId: "marked-exit" }, { type: "REPORT", caseId: "marked-exit" }];
    const labels = ["核对原出口与低位幻象", "准备普通标记路线", "准备有限晨曦破幻", "实际进行本次实践", "撤回待执行准备", "提交本次有限报告"];
    const value = dawn({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /^实际进行本次实践/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "marked-exit");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "已保存的原物实践记录" }).textContent).toContain("尚无实际破除记录");
    expect(screen.queryByRole("region", { name: "有限实践与实际结果" })).toBeNull();
  });

  it("pins an open case to its enabled public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(dawn({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "marked-exit"); const value = opened();
    rerender(<DawnPaladinPanel dawnPaladin={{ ...value, actions: [action({ type: "CLOSE", caseId: "marked-exit" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "armor-test" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "armor-test" }, "不可撤回代替离场"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("armor-test"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束铠甲试验并实际离场/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "armor-test" });
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/本次实践尚未实际结束/)).toBeTruthy();
  });

  it("does not manufacture CLOSE or infer an active practice from historical prose", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "黎明骑士成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("marked-exit");
    rerender(<DawnPaladinPanel dawnPaladin={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "armor-test");
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows actual illusion source cost and dispelling only from committed public facts", async () => {
    const value = dawn({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "marked-exit" }, "实际核对教学幻象")] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际核对教学幻象/ }));
    expect(screen.getByRole("region", { name: "已保存的原物实践记录" }).textContent).toContain("教学低位幻象尚未实际建立。 原教学施术者灵性：20");
    rerender(<DawnPaladinPanel dawnPaladin={{ ...value, practice: { ...value.practice, illusionCreated: true, volunteerSpirituality: 18, illusionDispelled: true } }} resources={resources} busy={false} onCommand={onCommand} />);
    const facts = screen.getByRole("region", { name: "已保存的原物实践记录" });
    for (const text of ["教学低位幻象已实际建立", "原教学施术者灵性：18", "已实际破除这一教学幻象", "原遮屏未记录移开"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /重置幻象|恢复施术者|自动破幻/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps armor breakage and original failure after actual CLOSE commits", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^结束铠甲试验并实际离场/ }));
    expect(screen.getByText(firstFailure)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => entry.id === "armor-test" ? { ...entry, contactOpen: "已实际结束", closes: 1 } : entry) };
    rerender(<DawnPaladinPanel dawnPaladin={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "已保存的原物实践记录" }).textContent).toContain("试探留下了铠甲裂纹记录");
    expect(screen.queryByRole("button", { name: /修复|治疗|清空失败/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves actual storm damage and weapon loss through CLOSE without recreating the original target", async () => {
    const value = dawn({ promoted: true, cases: cases(), insideCase: true,
      practice: { ...dawn().practice, stormCleared: true, instructorOutside: true, stormTarget: "DESTROYED", stormFrameScorched: true, stormSwordDispersed: true, stormArmorCracked: true },
      actions: [action({ type: "CLOSE", caseId: "cleared-storm" }, "结束本次风暴并实际离场", true, "0行动 · 0精神 · 0灵性")] });
    const { onCommand, rerender } = panel(value);
    const verify = () => {
      const facts = screen.getByRole("region", { name: "已保存的原物实践记录" });
      for (const text of ["本次练习场已实际清场", "同一练习原靶：已被实际风暴毁坏", "原靶框留下了风暴灼损", "本次风暴后晨曦武器已消散", "本次风暴留下了铠甲裂纹记录"]) expect(facts.textContent).toContain(text);
    };
    verify(); expect(screen.getByText(/导师当前在场外等候/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^结束本次风暴并实际离场/ })); verify();
    rerender(<DawnPaladinPanel dawnPaladin={{ ...value, insideCase: false, actions: [], practice: { ...value.practice, instructorOutside: false } }} resources={resources} busy={false} onCommand={onCommand} />);
    verify(); expect(screen.getByText(/导师当前未在场外等候/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重置原靶|免费凝剑|无害风暴/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "cleared-storm" });
  });

  it("keeps ordinary dismantling distinct from storm destruction and permits peaceful completion", async () => {
    const value = dawn({ promoted: true, cases: cases(), acting: 100, digestion: "本阶段已消化", actions: [],
      practice: { ...dawn().practice, screenRemoved: true, stormCleared: true, instructorOutside: true, stormTarget: "DISMANTLED" } });
    panel(value); await userEvent.selectOptions(screen.getByRole("combobox"), "cleared-storm");
    expect(screen.getByText("同一练习原靶：已由普通方法实际拆卸")).toBeTruthy();
    expect(screen.queryByText("原靶框留下了风暴灼损。")).toBeNull(); expect(screen.queryByText("本次风暴后晨曦武器已消散。")).toBeNull();
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "marked-exit");
    const facts = screen.getByRole("region", { name: "已保存的原物实践记录" });
    expect(facts.textContent).toContain("原遮屏已实际移开"); expect(facts.textContent).toContain("尚无实际破除记录");
  });

  it("clears temporary practice armor only after the public CLOSE result is saved", async () => {
    const original = opened();
    const value = { ...original, practice: { ...original.practice, armorActive: true } };
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^结束铠甲试验并实际离场/ }));
    expect(screen.getByRole("status").textContent).toContain("本次仍在持续：晨曦铠甲");
    rerender(<DawnPaladinPanel dawnPaladin={{ ...value, insideCase: false, actions: [], practice: { ...value.practice, armorActive: false } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByText(/本次仍在持续/)).toBeNull();
    expect(screen.getByRole("region", { name: "已保存的原物实践记录" }).textContent).toContain("试探留下了铠甲裂纹记录");
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "armor-test" });
  });

  it("blocks busy, externally blocked and failed-save actions without hiding actual facts", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<DawnPaladinPanel dawnPaladin={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(firstFailure)).toBeTruthy();
    }
    rerender(<DawnPaladinPanel dawnPaladin={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
    expect((screen.getByRole("button", { name: /^结束铠甲试验并实际离场/ }) as HTMLButtonElement).disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows four projected ability records and bounded, breakable, risky practice", () => {
    const abilities = [
      { id: "warrior.s6.dawn-light", label: "晨曦之光", mastery: 23, description: "尝试破除适用低位幻象。" },
      { id: "warrior.s6.dawn-armor", label: "晨曦铠甲", mastery: 41, description: "防护可能被击破。" },
      { id: "warrior.s6.dawn-weapon", label: "晨曦武器", mastery: 31, description: "凝聚与消散使用实际规则。" },
      { id: "warrior.s6.light-storm", label: "光之风暴", mastery: 17, description: "仍有波及人与原物的风险。" },
    ];
    panel(dawn({ promoted: true, cases: cases(), abilities, actions: [] }));
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "黎明骑士能力边界" });
    for (const text of ["适用低位幻象", "铠甲会被击破", "风暴可能波及人或原物", "清场也不保证无害", "三项实践保留普通方法", "本页不直接授予序列5守护者的代挡与分担伤害，须另行满足晋升条件"]) expect(boundary.textContent).toContain(text);
    expect(document.querySelector("audio, img, [data-guaranteed-victory]")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards ordinary Roald talk and his original-club encounter without invented commands", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与罗尔德交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原短棍战", true, "1行动 · 真实战斗风险");
    const environment = "罗尔德的原短棍仍由本人持有，现场退路已知。";
    const { onCommand } = panel(dawn({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    expect(encounter.getByText(/罗尔德是普通人，手持自己的原短棍/)).toBeTruthy();
    await userEvent.click(encounter.getByRole("button", { name: /^与罗尔德交涉/ })); await userEvent.click(encounter.getByRole("button", { name: /^承担原短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /夺取原棍|保证胜利|分担伤害/ })).toBeNull(); expect(screen.queryByRole("region", { name: "有限实践与实际结果" })).toBeNull();
  });

  it("keeps previous S7 original tools, failures, IDs, bottles and mastery read-only", () => {
    const weaponmaster: WeaponmasterProjection = {
      title: "武器大师", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原武器大师库存与耗用记录保留。", story: "原工具练习已完成。", environment: "原短棍已实际还给原保管者，借还历史保留。",
      cases: [{ id: "padded-mark", title: "原软垫标记", story: "首次原棍练习失败，实际消耗保留；后来重新核对。", status: "RESOLVED",
        observations: ["原短棍、软垫与标记均已核对。"], preparation: "只使用借来的同一原棍。", result: "实际复核原标记后报告，并归还原棍。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "weaponmaster-old", title: "武器大师旧原瓶", source: "武器大师原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "weaponmaster-old", confirmed: true } }],
      abilities: [{ id: "warrior.s7.weapons", label: "原武器技巧", mastery: 67, description: "保留实际使用原工具的掌握记录。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<DawnPaladinWeaponmasterHistory weaponmaster={weaponmaster} />);
    const history = within(screen.getByRole("region", { name: "武器大师时期的经历" }));
    for (const text of ["首次原棍练习失败，实际消耗保留；后来重新核对。", "原短棍、软垫与标记均已核对。", "原案卷ID：padded-mark", "原瓶ID：weaponmaster-old",
      "当时的方式与准备：只使用借来的同一原棍。", "当时的实际练习与报告：实际复核原标记后报告，并归还原棍。", "来源：武器大师原独立成品渠道", "已耗用 · 原失败保留",
      "原武器技巧 · 掌握 67：保留实际使用原工具的掌握记录。", weaponmaster.environment]) expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
