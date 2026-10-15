/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemonAction, DemonCommand, DemonProjection } from "../../src/domain/demon/types";
import type { SerialKillerProjection } from "../../src/domain/serial-killer/types";
import { DemonPanel, DemonSerialKillerHistory } from "../../src/renderer/DemonPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: DemonCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): DemonAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取恶魔成品用药指导", true, "360便士 · 1行动");
function demon(patch: Partial<DemonProjection> = {}): DemonProjection {
  return {
    title: "恶魔晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "连环杀手扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", strain: 0,
    practice: { body: "NORMAL", flame: "NONE" }, ...patch,
  };
}
function cases(): DemonProjection["cases"] {
  return [
    { id: "loading-lane", title: "装卸巷口的有限线索", story: "只从安全位置观察装卸巷口和实际退路，尚未取得本次线索。" },
    { id: "wide-door", title: "本人魔化与原窄门", story: "临时改变本人大小，原窄门和宽出口都仍在。" },
    { id: "cold-brazier", title: "同一冷火盆的有限火焰", story: "清空场地中的同一原火盆、原靶和原盖均已登记。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): DemonProjection {
  const originals = [
    { id: "demon-potion-1", title: "第一瓶恶魔魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "demon-potion-2", title: "第二瓶恶魔魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "demon-potion-3", title: "第三瓶恶魔魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return demon({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "第一次魔化未能完成，原灵性消耗和张力保留。";
const zeroClose = "0行动 · 0精神 · 0灵性 · 0新增张力";
function opened(): DemonProjection {
  return demon({ promoted: true, insideCase: true, strain: 3, practice: { body: "ENLARGED", flame: "NONE" },
    cases: cases().map((entry) => entry.id === "wide-door" ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本人已临时增大，原窄门没有变化；必须从原宽出口退开并复原。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId: "wide-door" }, "从原宽出口退开并恢复常态", true, zeroClose)],
  });
}
function panel(value: DemonProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DemonPanel demon={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Demon public practice, strain and saved original intent", () => {
  it("shows S7 maturity, G prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "连环杀手扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(demon({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "恶魔成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "当前渠道只提供有来源的独立成品，不提供完整晋升配方、材料与剂量；不展示虚构材料，也不开放晋升魔药调配。"])
      expect(summary.textContent).toContain(text);
    for (const marker of ["G指导", "尚未核实", "G独立成品"]) expect(summary.textContent).not.toContain(marker);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取恶魔成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: DemonCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "demon-potion-3" },
      { type: "BUY_POTION", bottleId: "demon-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(demon({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶恶魔魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶恶魔魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶恶魔魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶恶魔魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶恶魔魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶恶魔魔药」" }));
    expect(screen.getByText("demon-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "恶魔服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶恶魔魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "demon-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶恶魔魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶恶魔魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<DemonPanel demon={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶恶魔魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("demon-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<DemonPanel demon={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DemonPanel demon={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶恶魔魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶恶魔魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶恶魔魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<DemonPanel demon={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶恶魔魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶恶魔魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("demon-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶恶魔魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶恶魔魔药」" }));
    const promoted = { ...value, title: "恶魔", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升恶魔" } : bottle) };
    rerender(<DemonPanel demon={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶恶魔魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升恶魔")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects distinct originals and sends exact methods without optimistic clues, body or flame", async () => {
    const commands: DemonCommand[] = [{ type: "OBSERVE", caseId: "loading-lane" }, { type: "PREPARE", caseId: "loading-lane", method: "ORDINARY" },
      { type: "PREPARE", caseId: "loading-lane", method: "ABILITY" }, { type: "PERFORM", caseId: "loading-lane" },
      { type: "WITHDRAW", caseId: "loading-lane" }, { type: "VERIFY", caseId: "loading-lane" }, { type: "REPORT", caseId: "loading-lane" }];
    const labels = ["核对巷口", "准备普通观察", "准备有限预感", "实际观察一次", "撤回待执行准备", "核实现场证据", "提交有限报告"];
    const { onCommand } = panel(demon({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "恶魔实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "loading-lane");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前获得预感");
    expect(screen.getByText("当前本人身体：正常身体")).toBeTruthy(); expect(screen.getByText("当前原火盆：原冷火盆尚未点燃")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "冲动张力 0 / 3" })).toBeTruthy();
  });

  it("shows paid limited premonition separately from a zero-spirituality ordinary alternative", async () => {
    const paid = action({ type: "PERFORM", caseId: "loading-lane" }, "实际施用有限预感", true, "1行动 · 2灵性 · 张力+1");
    const ordinary = action({ type: "PREPARE", caseId: "loading-lane", method: "ORDINARY" }, "改用普通安全观察", true, "0灵性 · 0新增张力");
    const { onCommand } = panel(demon({ promoted: true, cases: cases(), actions: [paid, ordinary] }));
    expect(screen.getByText(paid.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际施用有限预感/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(paid.command);
    expect(screen.queryByRole("region", { name: "恶魔实际结果" })).toBeNull();
    expect(screen.getByRole("heading", { name: "冲动张力 0 / 3" })).toBeTruthy();
  });

  it("keeps noticed direction distinct from verified evidence and never dumps private plan fields", async () => {
    const secret = "PRIVATE_PLAN_NEVER_RENDER";
    const clue = "只感到装卸巷口方向有有限危险，尚未知道原因。";
    const evidence = "实际窗口痕迹与管理人的独立记录相符，现已核实本次危险。";
    const verify = action({ type: "VERIFY", caseId: "loading-lane" }, "核实实际窗口与管理人证据", true, "1行动 · 0灵性 · 0新增张力");
    const report = { ...action({ type: "REPORT", caseId: "loading-lane" }, "沿安全退路提交报告", false), reason: "尚未实际核实现场证据。" };
    const value = { ...demon({ promoted: true, strain: 1, cases: cases().map((entry) => entry.id === "loading-lane"
      ? { ...entry, status: "EXAMINED", result: clue, contactOpen: "已实际退开", closes: 1 } : entry), actions: [verify, report] }),
      threat: { active: true, noticed: true, verified: false, avoided: false, privatePlan: secret } };
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(clue)).toBeTruthy(); expect(screen.queryByText(evidence)).toBeNull();
    expect(document.body.textContent).not.toContain(secret); expect(document.body.textContent).not.toContain("privatePlan");
    expect((screen.getByRole("button", { name: /^沿安全退路提交报告/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^核实实际窗口/ }));
    expect(screen.getByText(clue)).toBeTruthy(); expect(screen.queryByText(evidence)).toBeNull();
    rerender(<DemonPanel demon={{ ...value, actions: [{ ...report, enabled: true, reason: null }], cases: value.cases.map((entry) => entry.id === "loading-lane" ? { ...entry, observations: [clue], result: evidence } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(clue)).toBeTruthy(); expect(screen.getByText(evidence)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^沿安全退路提交报告/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.textContent).not.toContain(secret); expect(onCommand).toHaveBeenCalledExactlyOnceWith(verify.command);
  });

  it("never infers hidden hostility from an unexamined scene or adds an oracle control", () => {
    const value = { ...demon({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "loading-lane" }, "从安全位置观察原巷口")] }),
      threat: { active: true, noticed: false, verified: false, avoided: false, source: "HIDDEN_HOSTILE_SOURCE" } };
    panel(value);
    expect(document.body.textContent).not.toContain("HIDDEN_HOSTILE_SOURCE");
    expect(screen.queryByRole("region", { name: "恶魔实际结果" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /读取|敌意|暴力|欲望|自动核实/ })).toBeNull();
  });

  it("pins actual contact to enabled zero-cost CLOSE even at full strain and no resources", async () => {
    const { onCommand, rerender } = panel(demon({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "cold-brazier"); const value = opened();
    rerender(<DemonPanel demon={{ ...value, actions: [action({ type: "CLOSE", caseId: "loading-lane" }, "旧现场不能结束", false), ...value.actions,
      action({ type: "VERIFY", caseId: "wide-door" }, "不可提前核实"), action({ type: "REPORT", caseId: "wide-door" }, "不可提前报告"),
      action({ type: "WITHDRAW", caseId: "wide-door" }, "不可撤回代替复原"), action({ type: "COMPOSE" }, "不可现场收束冲动"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("wide-door"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^从原宽出口退开并恢复常态/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "wide-door" });
    expect(screen.getByText(originalFailure)).toBeTruthy(); expect(screen.getByText("当前本人身体：本人身体仍处于临时魔化增大")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "冲动张力 3 / 3" })).toBeTruthy();
  });

  it("keeps body enlargement and the same narrow door until saved CLOSE actually restores normal size", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText("本人已临时增大，原窄门没有变化；必须从原宽出口退开并复原。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^从原宽出口退开并恢复常态/ }));
    expect(screen.getByText("当前本人身体：本人身体仍处于临时魔化增大")).toBeTruthy();
    rerender(<DemonPanel demon={{ ...value, insideCase: false, practice: { body: "NORMAL", flame: "NONE" }, actions: [],
      cases: value.cases.map((entry) => entry.id === "wide-door" ? { ...entry, closes: 1, contactOpen: "已实际恢复常态并退开" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前本人身体：正常身体")).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(screen.getByRole("heading", { name: "冲动张力 3 / 3" })).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
  });

  it("shows the original lit brazier and target, then committed cover extinguishing without refund", async () => {
    const result = "同一原火盆已点起有限火焰，原靶仍在，原盖尚未盖上。";
    const value = demon({ promoted: true, insideCase: true, strain: 2, practice: { body: "NORMAL", flame: "LIT" },
      cases: cases().map((entry) => entry.id === "cold-brazier" ? { ...entry, status: "EXAMINED", result, contactOpen: "本次火焰尚未收束" } : entry),
      actions: [action({ type: "CLOSE", caseId: "cold-brazier" }, "用原盖实际盖熄原火盆", true, zeroClose)] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("当前原火盆：同一原火盆的有限火焰仍在")).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^用原盖实际盖熄/ }));
    expect(screen.getByText("当前原火盆：同一原火盆的有限火焰仍在")).toBeTruthy();
    rerender(<DemonPanel demon={{ ...value, insideCase: false, practice: { body: "NORMAL", flame: "EXTINGUISHED" }, actions: [],
      cases: value.cases.map((entry) => entry.id === "cold-brazier" ? { ...entry, closes: 1, contactOpen: "已实际盖熄并退开" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前原火盆：同一原火盆已实际盖熄")).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "冲动张力 2 / 3" })).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "cold-brazier" });
  });

  it("does not manufacture CLOSE, report or normal state from historical prose", () => {
    const value = { ...opened(), actions: [] }; const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "恶魔成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(screen.getByText("当前本人身体：本人身体仍处于临时魔化增大")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("honors strain-cap reasons and preserves an ordinary method without forced violence", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "wide-door", method: "ABILITY" }, "准备再次魔化", false, "3灵性 · 张力+1"), reason: "冲动张力已达3，不能再施用能力。" };
    const ordinary = action({ type: "PREPARE", caseId: "wide-door", method: "ORDINARY" }, "选择普通宽门方法", true, "0灵性 · 0新增张力");
    const { onCommand } = panel(demon({ promoted: true, strain: 3, cases: cases(), actions: [ability, ordinary] }));
    const abilityButton = screen.getByRole("button", { name: /^准备再次魔化/ }) as HTMLButtonElement;
    expect(abilityButton.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy(); fireEvent.click(abilityButton);
    await userEvent.click(screen.getByRole("button", { name: /^选择普通宽门方法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(screen.queryByRole("button", { name: /暴力|伤人|失控/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "冲动张力 3 / 3" })).toBeTruthy();
  });

  it("sends COMPOSE once as a public intent and only shows reduced strain after save", async () => {
    const compose = action({ type: "COMPOSE" }, "离开接触后收束冲动", true, "1行动 · 张力-1 · 不治疗、不补灵性");
    const value = demon({ promoted: true, strain: 3, actions: [compose] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^离开接触后收束冲动/ }));
    expect(screen.getByRole("heading", { name: "冲动张力 3 / 3" })).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "COMPOSE" });
    expect(screen.getByText(compose.cost)).toBeTruthy(); expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    rerender(<DemonPanel demon={{ ...value, strain: 2 }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("heading", { name: "冲动张力 2 / 3" })).toBeTruthy(); expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
  });

  it("locks mutations and selection during busy, blocked and save-error states without clearing originals", () => {
    const value = demon({ promoted: true, strain: 2, cases: cases(), practice: { body: "NORMAL", flame: "EXTINGUISHED" }, actions: [
      action({ type: "OBSERVE", caseId: "loading-lane" }, "观察原现场"), action({ type: "COMPOSE" }, "收束冲动"), action({ type: "REFLECT" }, "反思原报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<DemonPanel demon={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByRole("heading", { name: "冲动张力 2 / 3" })).toBeTruthy(); expect(screen.getByText("当前原火盆：同一原火盆已实际盖熄")).toBeTruthy();
    }
    rerender(<DemonPanel demon={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps sources and limits folded with honest G peace-route and ability costs", () => {
    const story = "有限能力以已核实原文为边界，情境与和平替代路线为G原创。";
    panel(demon({ promoted: true, story, cases: cases(), actions: [], abilities: [
      { id: "abyss.s6.danger-premonition", label: "有限危险预感", mastery: 25, description: "只提示实际条件成立的有限方向。" },
      { id: "abyss.s6.demonic-body", label: "本人临时魔化", mastery: 35, description: "保留本人实际掌握。" },
      { id: "abyss.s6.flame-hex", label: "有限火焰", mastery: 15, description: "同一原火盆的实际火焰。" },
    ] }));
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看有限预感、张力与能力边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["2灵性、增加1张力", "3灵性、增加1张力", "普通安全方法0灵性、0张力", "原窄门不会随身体变大", "三项有限实践报告各25", "和平替代路线100", "这不保证无代价、安全完成恶魔扮演", "序列5欲望操纵", "达到张力上限后回退普通方法"])
      expect(boundary.textContent).toContain(text);
    expect(boundary.textContent).toContain("三项有限实践报告各25扮演进度，反思25，可完成和平替代路线100。这不保证无代价、安全完成恶魔扮演；风险、张力、失败与实际消耗继续保留。");
    for (const marker of ["本作G原创", "原著"]) expect(boundary.textContent).not.toContain(marker);
    expect(screen.queryByRole("button", { name: /欲望|读心|犯罪/ })).toBeNull();
  });

  it("forwards original non-pursuit choices with the real exit and no combat premonition oracle", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "与莫顿交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(demon({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "莫顿与自己的普通短棍仍在原外院。", actions }));
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "恶魔扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = within(screen.getByRole("region", { name: "恶魔有限冲突" }));
    for (const text of ["相隔2米", "原清空外院", "真实出口", "这里不追击", "危险预感R为0"]) expect(encounter.getByText(/莫顿持自己的普通短棍/).textContent).toContain(text);
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("retains S7 stories, ritual closures, failed assertions and original bottles as read-only history", () => {
    const serialKiller: SerialKillerProjection = {
      title: "连环杀手", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原连环杀手供给记录保留。", story: "原连环杀手故事。", environment: "已收束原仪式并离开。",
      cases: [{ id: "false-dedication", title: "原题献核实", story: "初次核实失败，原消耗仍保留。", status: "RESOLVED", observations: ["原抄本与普通对照已核对。"],
        preparation: "只核对已登记原抄本。", result: "实际收束后提交有限报告。", contactOpen: "原仪式接触已结束", closures: 2, overclaims: 1 }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "serial-killer-original-1", title: "连环杀手旧原瓶", source: "独立连环杀手原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "serial-killer-original-1", confirmed: true } }],
      abilities: [{ id: "abyss.s7.ritual-practice", label: "原有限仪式", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<DemonSerialKillerHistory serialKiller={serialKiller} />);
    const history = within(screen.getByRole("region", { name: "连环杀手时期的经历" }));
    for (const text of ["原连环杀手故事。", "原连环杀手供给记录保留。", "初次核实失败，原消耗仍保留。", "原抄本与普通对照已核对。", "原案卷ID：false-dedication", "原瓶ID：serial-killer-original-1",
      "当时的方式与准备：只核对已登记原抄本。", "当时的仪式接触：原仪式接触已结束", "当时实际收束次数：2 · 原越界断言次数：1", "当时的实际结果与报告：实际收束后提交有限报告。", "来源：独立连环杀手原渠道", "已耗用 · 原失败保留", "原有限仪式 · 掌握 67：保留原能力实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升恶魔（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
    for (const details of screen.getByRole("region", { name: "连环杀手时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
