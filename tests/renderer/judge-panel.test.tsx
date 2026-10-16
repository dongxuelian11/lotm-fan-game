/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgeAction, JudgeCommand, JudgeProjection } from "../../src/domain/judge/types";
import type { InterrogatorProjection } from "../../src/domain/interrogator/types";
import { JudgePanel, JudgeInterrogatorHistory } from "../../src/renderer/JudgePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: JudgeCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): JudgeAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取法官成品用药指导", true, "360便士 · 1行动");
function judge(patch: Partial<JudgeProjection> = {}): JudgeProjection {
  return {
    title: "法官晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "审讯者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: { audience: "READY", boundary: "CLEAR", token: "ON_TABLE", lineTestedBy: "NONE", tokenTestedBy: "NONE" }, ...patch,
  };
}
function cases(): JudgeProjection["cases"] {
  return [
    { id: "calm-room", title: "自愿谈话的短暂注意", story: "薇娜与成年志愿者瑟恩同意短暂练习；注意不等于真话或服从。" },
    { id: "marked-line", title: "双方同受限的原标线", story: "玩家与瑟恩均须实际尝试跨越同一原标线，不能只限制对方。" },
    { id: "shared-token", title: "同一原木牌与原台域", story: "玩家与瑟恩分别尝试带出同一原木牌，限制不转移物品产权。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): JudgeProjection {
  const originals = [
    { id: "judge-potion-1", title: "第一瓶法官魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "judge-potion-2", title: "第二瓶法官魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "judge-potion-3", title: "第三瓶法官魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return judge({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "原判断失败，已经支付的灵性与本次风险保留。";
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(caseId = "shared-token", practice: JudgeProjection["practice"] = { ...judge().practice, token: "OUTSIDE_TABLE", tokenTestedBy: "BOTH" }): JudgeProjection {
  return judge({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本次实际结果已记录，现场仍需实际收束。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "结束本次实践，回到生活", true, zeroClose)],
  });
}
function panel(value: JudgeProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<JudgePanel judge={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Judge public practice and saved original intent", () => {
  it("shows S7 maturity, actual prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "审讯者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(judge({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "法官成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "当前渠道只提供有来源的独立成品，不提供完整晋升配方、材料与剂量；不展示虚构材料，也不开放晋升魔药调配。"])
      expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取法官成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: JudgeCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "judge-potion-3" },
      { type: "BUY_POTION", bottleId: "judge-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(judge({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /^查看并准备服用「第一瓶法官魔药」/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶法官魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶法官魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶法官魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶法官魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶法官魔药」/ }));
    expect(screen.getByText("judge-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "法官服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶法官魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "judge-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶法官魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶法官魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<JudgePanel judge={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶法官魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("judge-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<JudgePanel judge={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<JudgePanel judge={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶法官魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶法官魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶法官魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<JudgePanel judge={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^查看并准备服用「第一瓶法官魔药」/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶法官魔药」/ }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("judge-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶法官魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶法官魔药」" }));
    const promoted = { ...value, title: "法官", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升法官" } : bottle) };
    rerender(<JudgePanel judge={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶法官魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升法官")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes same-title original bottles and submits the selected stable ID only once", async () => {
    const value = bottled();
    value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "法官成品魔药" }));
    const { onCommand } = panel(value);
    const second = screen.getByRole("button", { name: "查看并准备服用「法官成品魔药」 · 原瓶 judge-potion-2" });
    await userEvent.click(second);
    expect(screen.getByText("judge-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.queryByText("judge-potion-1")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「法官成品魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "judge-potion-2", confirmed: true });
  });

  it("renders the three public scenes and forwards prepared methods without applying a result", async () => {
    const commands: JudgeCommand[] = [
      { type: "OBSERVE", caseId: "calm-room" }, { type: "PREPARE", caseId: "calm-room", method: "ORDINARY" },
      { type: "PREPARE", caseId: "calm-room", method: "ABILITY" }, { type: "PERFORM", caseId: "calm-room" },
      { type: "WITHDRAW", caseId: "calm-room" }, { type: "REPORT", caseId: "calm-room" },
    ];
    const labels = ["核对自愿谈话边界", "准备普通请求", "准备有限威严", "实际执行本次方法", "撤回本次准备", "提交有限报告"];
    const { onCommand } = panel(judge({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "法官实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "calm-room");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前获得注意、触发跨线限制或移动原木牌");
    for (const text of ["当前自愿谈话：自愿谈话尚未实际开始", "当前原标线：原标线仍在，双方尚未实际尝试跨越", "当前原木牌：同一原木牌仍在原台，尚未实际尝试带出", "实际跨线测试：双方尚未实际尝试", "实际带牌测试：双方尚未实际尝试"])
      expect(screen.getByText(text)).toBeTruthy();
  });

  it("honors actual ability costs and shortages while retaining the ordinary route", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "marked-line", method: "ABILITY" }, "准备有限禁令", false, "1行动 · 执行需3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "marked-line", method: "ORDINARY" }, "准备普通约定", true, "1行动 · 0灵性");
    const { onCommand } = panel(judge({ promoted: true, cases: cases(), actions: [ability, ordinary] }));
    const abilityButton = screen.getByRole("button", { name: /^准备有限禁令/ }) as HTMLButtonElement;
    expect(abilityButton.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy();
    expect(abilityButton.getAttribute("aria-describedby")).toBe(`judge-reason-${ability.id}`);
    expect(screen.getByText(ability.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    fireEvent.click(abilityButton); await userEvent.click(screen.getByRole("button", { name: /^准备普通约定/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("region", { name: "法官实际结果" })).toBeNull();
  });

  it.each([
    { caseId: "calm-room", practice: { ...judge().practice, audience: "ATTENTIVE" } },
    { caseId: "marked-line", practice: { ...judge().practice, boundary: "HELD", lineTestedBy: "BOTH" } },
    { caseId: "shared-token", practice: { ...judge().practice, token: "HELD_ON_TABLE", tokenTestedBy: "BOTH" } },
  ] as { caseId: string; practice: JudgeProjection["practice"] }[])("pins active $caseId to its zero-cost CLOSE even at zero resources", async ({ caseId, practice }) => {
    const { onCommand, rerender } = panel(judge({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "calm-room" ? "marked-line" : "calm-room";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId, practice);
    rerender(<JudgePanel judge={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧场景不能结束本次实践", false), ...value.actions,
      action({ type: "REPORT", caseId }, "不可提前报告"), action({ type: "WITHDRAW", caseId }, "不可撤回准备代替结束"),
      action({ type: "PREPARE", caseId, method: "ORDINARY" }, "不可提前重置原物"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前交涉"),
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
    expect(screen.getByRole("region", { name: "法官成长下一步" }).textContent).toContain("先结束本次实践，回到生活");
  });

  it.each([
    { caseId: "calm-room", field: "audience", before: "ADDRESSED", after: "FREE", oldText: "当前自愿谈话：已经实际提出请求，本次谈话尚未结束", newText: "当前自愿谈话：本次谈话与短暂影响已结束，当事人可自由离开" },
    { caseId: "calm-room", field: "audience", before: "ATTENTIVE", after: "FREE", oldText: "当前自愿谈话：本次已实际获得短暂注意，谈话尚未结束", newText: "当前自愿谈话：本次谈话与短暂影响已结束，当事人可自由离开" },
    { caseId: "marked-line", field: "boundary", before: "ATTEMPTED", after: "RELEASED", oldText: "当前原标线：双方已实际尝试跨线，本次未形成有效限制，仍需结束", newText: "当前原标线：本次限制已实际撤回，原标线仍在，双方可自由跨越" },
    { caseId: "marked-line", field: "boundary", before: "HELD", after: "RELEASED", oldText: "当前原标线：双方已实际尝试跨线，本次均停留在原标线内", newText: "当前原标线：本次限制已实际撤回，原标线仍在，双方可自由跨越" },
    { caseId: "shared-token", field: "token", before: "OUTSIDE_TABLE", after: "RETURNED", oldText: "当前原木牌：同一原木牌已带出台域，仍由实际持牌者持有，尚未放回", newText: "当前原木牌：同一原木牌已安全放回原台，本次限制已实际撤回" },
    { caseId: "shared-token", field: "token", before: "HELD_ON_TABLE", after: "RETURNED", oldText: "当前原木牌：双方已实际尝试，同一原木牌仍在原台域内", newText: "当前原木牌：同一原木牌已安全放回原台，本次限制已实际撤回" },
  ])("keeps $field $before visible until actual closure is saved", async ({ caseId, field, before, after, oldText, newText }) => {
    const practice = { ...judge().practice, [field]: before, lineTestedBy: caseId === "marked-line" ? "BOTH" : "NONE", tokenTestedBy: caseId === "shared-token" ? "BOTH" : "NONE" } as JudgeProjection["practice"];
    const value = opened(caseId, practice); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(oldText)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^结束本次实践，回到生活/ }));
    expect(screen.getByText(oldText)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    rerender(<JudgePanel judge={{ ...value, insideCase: false, actions: [], practice: { ...practice, [field]: after },
      cases: value.cases.map((entry) => entry.id === caseId ? { ...entry, closes: 1, contactOpen: "已实际结束本次实践" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(newText)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
  });

  it("records both actual tests only after committed execution and retains them after withdrawal", async () => {
    const before = judge({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "双方将依次尝试，本次尚未执行。" })),
      actions: [action({ type: "PERFORM", caseId: "shared-token" }, "实际测试同一原木牌")] });
    const { onCommand, rerender } = panel(before);
    await userEvent.click(screen.getByRole("button", { name: /^实际测试同一原木牌/ }));
    expect(screen.getByText("实际带牌测试：双方尚未实际尝试")).toBeTruthy();
    const executed = opened("shared-token", { ...before.practice, token: "OUTSIDE_TABLE", tokenTestedBy: "BOTH" });
    executed.cases = executed.cases.map((entry) => entry.id === "shared-token" ? { ...entry, result: "玩家实试后交给瑟恩，瑟恩带出同一原木牌；禁令未生效，原牌仍在瑟恩手中。" } : entry);
    rerender(<JudgePanel judge={executed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("实际带牌测试：玩家与当事人双方均已实际尝试")).toBeTruthy();
    expect(screen.getByRole("region", { name: "法官实际结果" }).textContent).toContain("原牌仍在瑟恩手中");
    const closed = { ...executed, insideCase: false, actions: [], practice: { ...executed.practice, token: "RETURNED" as const } };
    rerender(<JudgePanel judge={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("实际带牌测试：玩家与当事人双方均已实际尝试")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PERFORM", caseId: "shared-token" });
  });

  it.each([
    { caseId: "marked-line", practice: { ...judge().practice, boundary: "HELD", lineTestedBy: "BOTH" }, result: "双方依照普通约定自愿停步，本次没有施加禁令。" },
    { caseId: "shared-token", practice: { ...judge().practice, token: "HELD_ON_TABLE", tokenTestedBy: "BOTH" }, result: "双方依照普通约定把同一原木牌留在原台域，没有施加禁令。" },
    { caseId: "calm-room", practice: { ...judge().practice, audience: "ATTENTIVE" }, result: "瑟恩自愿短暂注意，本次普通请求不保证真话。" },
  ] as { caseId: string; practice: JudgeProjection["practice"]; result: string }[])("keeps ordinary cooperation separate from supernatural success in $caseId", ({ caseId, practice, result }) => {
    const value = opened(caseId, practice);
    value.cases = value.cases.map((entry) => entry.id === caseId ? { ...entry, result } : entry);
    panel(value);
    expect(screen.getByRole("region", { name: "法官实际结果" }).textContent).toContain(result);
    const current = screen.getByRole("region", { name: "当前自愿谈话、原标线与原木牌" });
    expect(current.textContent).toContain("当事人的注意不等于真话");
    expect(current.textContent).not.toContain("本次禁令成功");
  });

  it("does not manufacture an exit or a restored original from historical prose", () => {
    const value = { ...opened(), actions: [], cases: cases().map((entry) => ({ ...entry, result: "上次已撤回禁行并放回原木牌，本次仍需实际处理。" })) };
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "法官成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.getByText("当前原木牌：同一原木牌已带出台域，仍由实际持牌者持有，尚未放回")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks selection and mutations during pending save or error, while retaining saved facts", () => {
    const value = judge({ promoted: true, cases: cases(), practice: { audience: "FREE", boundary: "RELEASED", token: "RETURNED", lineTestedBy: "BOTH", tokenTestedBy: "BOTH" }, actions: [
      action({ type: "OBSERVE", caseId: "calm-room" }, "观察自愿现场"), action({ type: "REFLECT" }, "反思有限报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<JudgePanel judge={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("当前原木牌：同一原木牌已安全放回原台，本次限制已实际撤回")).toBeTruthy();
      expect(screen.getByText("实际跨线测试：玩家与当事人双方均已实际尝试")).toBeTruthy();
    }
    rerender(<JudgePanel judge={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows seven inherited and two new records with finite, shared restrictions", () => {
    const ids = ["justiciar.s9.authority", "justiciar.s9.persuasive-charisma", "justiciar.s9.combat-training", "justiciar.s8.trace-sensing", "justiciar.s8.image-reconstruction", "justiciar.s7.mental-puncture", "justiciar.s7.mental-pressure", "justiciar.s6.authority", "justiciar.s6.prohibition"];
    const labels = ["原威严", "令人信服的魅力", "格斗训练", "痕迹感应", "图像重建", "精神刺穿", "精神压迫", "法官威严", "有限禁令"];
    const abilities = ids.map((id, index) => ({ id, label: labels[index]!, mastery: index + 10, description: `保留第${index + 1}项实际掌握。` }));
    const story = "有限禁令按已核原文边界实现，三段具体场地和和平路线为G原创。";
    panel(judge({ promoted: true, story, cases: cases(), actions: [], abilities }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 9 项训练记录" })).toBeTruthy();
    for (const ability of abilities) {
      expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(screen.getByText(ability.description)).toBeTruthy();
    }
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看有限威严、禁令与继承能力边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["继承七项原能力", "短暂注意", "不保证服从、真话", "可能失败或被抵抗", "双方同受", "同一原木牌", "物品产权不被改写", "不授予官方身份", "自由离开", "本轮余下的身体近击", "本轮结束时解除", "不取消行动槽或其它技能", "不追溯", "不提前开放序列5惩戒", "普通方法保留", "结束实践0行动、0精神、0灵性", "实际注意与停止动作都不能证明对方有罪，实践成功也不保证战斗成功。"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not expose private facts, hidden intents or an unverified formula", () => {
    const value = { ...judge({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "calm-room" }, "核对当前自愿谈话")] }),
      privatePlan: "PRIVATE_PLAN_NEVER_RENDER", future: "FUTURE_ROLL_NEVER_RENDER", hiddenIntention: "SECRET_INTENT_NEVER_RENDER" };
    panel(value);
    for (const secret of ["PRIVATE_PLAN_NEVER_RENDER", "FUTURE_ROLL_NEVER_RENDER", "SECRET_INTENT_NEVER_RENDER"])
      expect(document.body.textContent).not.toContain(secret);
    expect(screen.queryByRole("region", { name: "法官实际结果" })).toBeNull(); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /永久封禁|宣判有罪|获得官方身份|惩戒|调配/ })).toBeNull();
  });

  it("forwards conflict choices with the current-round, both-sides combat boundary", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "澄清原场地争议"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(judge({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "原对手和双方的普通短棍仍在原外院。", actions }));
    expect(screen.getByRole("progressbar", { name: "法官扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = within(screen.getByRole("region", { name: "法官有限冲突" }));
    for (const text of ["已有出口", "实际退出", "这里不追击", "本轮余下的身体近击", "敌我双方同受约束", "本轮结束时解除", "不取消整个行动槽或其它技能", "不追溯已经结算的动作", "可能失败或被抵抗", "真实伤势"])
      expect(encounter.getByText(/只按当前公开现场交涉或承担冲突/).textContent).toContain(text);
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("preserves contradictory accounts, personal withdrawal, failures and old bottles as read-only history", () => {
    const interrogator: InterrogatorProjection = {
      title: "审讯者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原审讯者供给记录保留。", story: "原审讯者故事。", environment: "原自愿谈话已经实际结束。",
      cases: [
        { id: "conflicting-delivery", title: "两份原日期矛盾", story: "原矛盾仍需交叉核实，精神能力不保证真话。", status: "RESOLVED", observations: ["原记录甲为周三，原记录乙为周四。"], preparation: "普通核对原陈述。", result: "矛盾未抹去，原失败和成本保留。", contactOpen: "已实际结束原接触", closes: 2 },
        { id: "withdrawn-interview", title: "本人原先撤回", story: "本人在示范前撤回同意。", status: "RESOLVED", observations: ["当事人明确要求停止。"], preparation: "实际尊重撤回。", result: "没有继续施压，不把拒绝改写为有罪。", contactOpen: "本人已经自由离开", closes: 1 },
      ],
      actions: [{ id: "old-perform", label: "不可在旧历史中重做精神压迫", enabled: true, reason: null, cost: "3灵性", command: { type: "PERFORM", caseId: "withdrawn-interview" } }],
      bottles: [{ id: "interrogator-original-1", title: "审讯者旧原瓶", source: "独立审讯者原批成品", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "interrogator-original-1", confirmed: true } }],
      abilities: [{ id: "justiciar.s7.mental-pressure", label: "原精神压迫", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<JudgeInterrogatorHistory interrogator={interrogator} />);
    const history = within(screen.getByRole("region", { name: "审讯者时期的经历" }));
    for (const text of ["原审讯者故事。", "原审讯者供给记录保留。", "原矛盾仍需交叉核实，精神能力不保证真话。", "原记录甲为周三，原记录乙为周四。", "原案卷ID：conflicting-delivery", "原瓶ID：interrogator-original-1", "本人在示范前撤回同意。", "当事人明确要求停止。", "当时的方式与准备：普通核对原陈述。", "当时的接触：已实际结束原接触", "当时实际结束次数：2", "当时的实际结果与报告：矛盾未抹去，原失败和成本保留。", "当时的实际结果与报告：没有继续施压，不把拒绝改写为有罪。", "来源：独立审讯者原批成品", "已耗用 · 原失败保留", "原精神压迫 · 掌握 67：保留原能力实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升法官（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可在旧历史中重做精神压迫")).toBeNull();
    for (const details of screen.getByRole("region", { name: "审讯者时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
