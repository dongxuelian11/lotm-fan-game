/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FireThiefAction, FireThiefCommand, FireThiefProjection } from "../../src/domain/fire-thief/types";
import type { CryptologistProjection } from "../../src/domain/cryptologist/types";
import { FireThiefPanel, FireThiefCryptologistHistory } from "../../src/renderer/FireThiefPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections test presentation only; domain tests own costs and resolution.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "大成功、成功可晋升；失败、灾难消耗这一原瓶，排异与实际损失保留。";
function action(command: FireThiefCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): FireThiefAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取盗火人成品指导", true, "360便士 · 1行动");
function fireThief(patch: Partial<FireThiefProjection> = {}): FireThiefProjection {
  return {
    title: "盗火人晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "解密学者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", samples: [],
    loan: { caseId: null, sample: null, playerSteps: 0, targetSteps: 0, uses: 0, elapsedSteps: 0 },
    battleLoan: { playerRounds: 0, targetRounds: 0, startedRound: null, uses: 0 },
    enemyCourageSeen: false, enemySpirituality: 10, ...patch,
  };
}
function cases(): FireThiefProjection["cases"] {
  return [
    { id: "borrowed-flash", title: "借来的一束闪光", story: "瑟蕾同意尝试，实际窃得的也可能是霜冷，普通遮挡同样可行。" },
    { id: "separate-windows", title: "不同的两段时窗", story: "诺汀同意有限勇气试验，自己的到期与来源恢复分别观察。" },
    { id: "unknown-power", title: "没有真实来源的请求", story: "没有实际高位能力来源，只能复核已知资料并拒绝越界。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function samples(): FireThiefProjection["samples"] {
  return [
    { id: "FLASH", label: "闪光", source: "瑟蕾·芬恩，成年自愿者的真实闪光", instructorSpirituality: 16, demonstrated: true },
    { id: "FROST", label: "霜冷", source: "瑟蕾·芬恩，成年自愿者的真实霜冷", instructorSpirituality: 16, demonstrated: true },
    { id: "COURAGE", label: "勇气", source: "诺汀·布莱尔，成年自愿者的真实勇气", instructorSpirituality: 19, demonstrated: false },
  ];
}
function bottled(): FireThiefProjection {
  const bottles = [
    { id: "fireThief-potion-1", title: "第一瓶盗火人魔药", source: "原渠道第一瓶独立成品", chance: 71 },
    { id: "fireThief-potion-2", title: "第二瓶盗火人魔药", source: "原渠道第二瓶独立采购", chance: 43 },
    { id: "fireThief-potion-3", title: "第三瓶盗火人魔药", source: "原渠道第三瓶独立封装", chance: 61 },
  ];
  return fireThief({ guidanceKnown: true, supplies: "三瓶独立成品按原劳务与付款记录领取。",
    actions: bottles.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗这一原瓶")),
    bottles: bottles.map((bottle): FireThiefProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "本想窃取闪光，实际暂时窃得霜冷；1行动与3灵性的原成本保留。";
function opened(): FireThiefProjection {
  return fireThief({ promoted: true, insideCase: true, samples: samples(),
    loan: { caseId: "borrowed-flash", sample: "FROST", playerSteps: 2, targetSteps: 3, uses: 0, elapsedSteps: 0 },
    cases: cases().map((entry) => entry.id === "borrowed-flash" ? { ...entry, status: "EXAMINED", observations: [firstFailure],
      preparation: "尝试实际窃取已经观察的闪光。", result: "实际霜冷尚未使用，本次接触尚未结束。", contactOpen: "本次接触尚未实际结束", closes: 0 } : entry),
    actions: [
      action({ type: "USE", caseId: "borrowed-flash" }, "使用实际借得的霜冷", true, "0行动 · 2灵性 · 推进1现场时段"),
      action({ type: "WAIT", caseId: "borrowed-flash" }, "不使用能力，等待一个时段", true, "0行动 · 0精神 · 0灵性"),
      action({ type: "CLOSE", caseId: "borrowed-flash" }, "等待来源恢复并实际离场", true, "0行动 · 0精神 · 0灵性"),
    ],
  });
}
function panel(value: FireThiefProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<FireThiefPanel fireThief={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("FireThief actual borrowed ability, separate finite windows and original bottles", () => {
  it("shows public maturity and supply without synthesizing formula, bottles or commands", () => {
    const reason = "解密学者扮演100；晋升后11/12个完整周，尚未成熟。";
    const supply = "第三瓶尚未实际取得，原劳务4/5。";
    const { onCommand } = panel(fireThief({ digestion: reason, supplies: supply, formula: [{ name: "未核实材料不显示", quantity: 12, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "盗火人成长下一步" });
    expect(summary.textContent).toContain(reason); expect(summary.textContent).toContain("完整魔药配方、材料与剂量仍未核实");
    expect(screen.getByText(supply)).toBeTruthy(); expect(screen.queryByText("未核实材料不显示")).toBeNull();
    const button = screen.getByRole("button", { name: /^听取盗火人成品指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|查看并准备服用/ })).toBeNull();
  });

  it("forwards public acquisition and resupply commands with their exact public costs", async () => {
    const commands: FireThiefCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "fireThief-potion-3" },
      { type: "BUY_POTION", bottleId: "fireThief-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "320便士 · 0行动", "1行动 · 下周到货", "0行动 · 登记原瓶"];
    const { onCommand } = panel(fireThief({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    costs.forEach((cost) => expect(screen.getByText(cost)).toBeTruthy());
  });

  it("cancels bottle confirmation with keyboard or button at zero AP and restores focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶盗火人魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶盗火人魔药" }));
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶盗火人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶盗火人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶盗火人魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows source, four-tier risk and current resources before submitting the original once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶盗火人魔药」" }));
    expect(screen.getByText("fireThief-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶独立采购")).toBeTruthy();
    expect(screen.getByRole("region", { name: "盗火人服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"].forEach((text) => expect(current.getByText(text)).toBeTruthy());
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶盗火人魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("region", { name: "盗火人能力与消化" })).toBeNull();
  });

  it("retains failed-save confirmation and leaves retry of the identical envelope to the parent", async () => {
    const value = bottled(); const envelope = { intentId: "original-fireThief-consume", expectedRevision: 82, payload: value.actions[0]!.command };
    const sendEnvelope = vi.fn(); const onCommand = vi.fn(() => sendEnvelope(envelope));
    const { rerender } = render(<><button onClick={() => sendEnvelope(envelope)}>父级重试原操作</button><FireThiefPanel fireThief={value} resources={resources} busy={false} onCommand={onCommand} /></>);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶盗火人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶盗火人魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<><button onClick={() => sendEnvelope(envelope)}>父级重试原操作</button><FireThiefPanel fireThief={value} resources={resources} busy={false} error={error} onCommand={onCommand} /></>);
    const confirmation = within(screen.getByRole("region", { name: "这瓶盗火人魔药的服用确认" }));
    expect(confirmation.getByRole("status").textContent).toContain(error.message); expect(confirmation.queryByRole("button", { name: /重试/ })).toBeNull();
    expect((confirmation.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirmation.getByRole("button", { name: "确认服用「第一瓶盗火人魔药」" })); await userEvent.keyboard("{Escape}");
    expect(confirmation.getByText("fireThief-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "父级重试原操作" }));
    expect(sendEnvelope).toHaveBeenCalledTimes(2); expect(sendEnvelope.mock.calls[0]![0]).toBe(sendEnvelope.mock.calls[1]![0]);
  });

  it("keeps a committed failed original and separately confirms a remaining original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶盗火人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶盗火人魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败保留" } : bottle) };
    rerender(<FireThiefPanel fireThief={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败保留")).toBeTruthy(); expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶盗火人魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶盗火人魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("fireThief-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("leaves confirmation only after committed promotion and retains consumed bottle history", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶盗火人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶盗火人魔药」" }));
    rerender(<FireThiefPanel fireThief={{ ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升盗火人" } : bottle) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶盗火人魔药的服用确认" })).toBeNull(); expect(screen.getByRole("region", { name: "盗火人能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升盗火人")).toBeTruthy(); expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses changed public eligibility and risk without guessing a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶盗火人魔药」" }));
    const reason = "当前精神不足，不能服用这一原瓶。";
    const updated = { ...value, risk: "本次尚未判定，四档风险以当前指导为准。", bottles: value.bottles.map((bottle, index) => index === 1 ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry, index) => index === 1 ? { ...entry, enabled: false, reason } : entry) };
    rerender(<FireThiefPanel fireThief={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶盗火人魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only public sources, mastery and conflict options without inventing a loan", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与原现场人物交涉", true, "1行动 · 实际交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原现场战斗", true, "1行动 · 真实战斗风险");
    const value = fireThief({ promoted: true, samples: samples(), actions: [talk, fight], abilities: [
      { id: "error.s6.power-theft", label: "有限能力窃取", mastery: 23, description: "只有实际来源和公开判定允许暂时借用。" },
    ] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "当前借用与两段时窗" }).textContent).toContain("当前没有实际借得的临时能力");
    const boundary = screen.getByRole("region", { name: "盗火人能力边界" });
    ["实际窃得的能力可能与预期不同", "不会永久学会", "不永久删除", "三案均有0灵性", "至少需要一次实际使用", "序列5窃梦家", "不能抹去污染", "战斗借用与来源失能另按战斗面板结算", "不等于战斗回合"].forEach((text) => expect(boundary.textContent).toContain(text));
    expect(boundary.textContent).toContain("三案均有0灵性的普通核实路线；未知高位来源只能核对已知资料并拒绝越界。能力路线至少需要一次实际使用才能形成有限报告。盗火人本页不提供序列5窃梦家的念头或梦境窃取，也不能抹去污染。");
    expect(screen.getByText("有限能力窃取 · 掌握 23")).toBeTruthy();
    for (const sample of value.samples) expect(screen.getByRole("region", { name: `${sample.label}的公开来源` }).textContent).toContain(sample.source);
    expect(screen.getByRole("region", { name: "勇气的公开来源" }).textContent).toContain("尚无本次实际示范");
    for (const command of [talk, fight]) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${command.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /立即借用|免费能力|窃取梦境|窃取念头/ })).toBeNull();
  });

  it("shows the actually stolen FROST rather than desired FLASH and keeps the two public windows distinct", async () => {
    const prepare = action({ type: "PREPARE", caseId: "borrowed-flash", method: "ABILITY" }, "准备尝试窃取闪光", true, "1行动 · 准备不窃取");
    const perform = action({ type: "PERFORM", caseId: "borrowed-flash" }, "实际尝试窃取闪光", true, "1行动 · 3灵性 · 失败照付");
    const before = fireThief({ promoted: true, cases: cases(), samples: samples(), actions: [prepare, perform] });
    const { onCommand, rerender } = panel(before);
    expect(screen.getByText(perform.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^准备尝试窃取闪光/ }));
    await userEvent.click(screen.getByRole("button", { name: /^实际尝试窃取闪光/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, perform.command]);
    expect(screen.getByRole("region", { name: "当前借用与两段时窗" }).textContent).toContain("当前没有实际借得的临时能力");
    const value = opened();
    rerender(<FireThiefPanel fireThief={value} resources={{ ...resources, spirituality: 9 }} busy={false} onCommand={onCommand} />);
    const loan = within(screen.getByRole("region", { name: "当前借用与两段时窗" }));
    expect(loan.getByText("本次实际窃得：霜冷")).toBeTruthy(); expect(loan.queryByText("本次实际窃得：闪光")).toBeNull();
    expect(loan.getByText("来源：瑟蕾·芬恩，成年自愿者的真实霜冷")).toBeTruthy();
    expect(loan.getByText("自身可用剩余时段").parentElement?.textContent).toContain("2 个现场时段");
    expect(loan.getByText("来源失能剩余时段").parentElement?.textContent).toContain("3 个现场时段");
    expect(loan.getByText("本次实际使用次数").parentElement?.textContent).toContain("0 次");
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(2);
    expect(loan.queryByText(/12小时|10分钟|永久掌握/)).toBeNull();
  });

  it("forwards actual USE at zero AP and allows a second public use only after displaying committed time", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^使用实际借得的霜冷/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    const loan = () => within(screen.getByRole("region", { name: "当前借用与两段时窗" }));
    expect(loan().getByText("自身可用剩余时段").parentElement?.textContent).toContain("2 个现场时段");
    expect(loan().getByText("本次实际使用次数").parentElement?.textContent).toContain("0 次");
    const used = { ...value, loan: { ...value.loan, playerSteps: 1, targetSteps: 2, uses: 1, elapsedSteps: 1 } };
    rerender(<FireThiefPanel fireThief={used} resources={{ ...resources, spirituality: 10 }} busy={false} onCommand={onCommand} />);
    expect(loan().getByText("自身可用剩余时段").parentElement?.textContent).toContain("1 个现场时段");
    expect(loan().getByText("来源失能剩余时段").parentElement?.textContent).toContain("2 个现场时段");
    expect(loan().getByText("本次实际使用次数").parentElement?.textContent).toContain("1 次");
    await userEvent.click(screen.getByRole("button", { name: /^使用实际借得的霜冷/ }));
    expect(onCommand).toHaveBeenCalledTimes(2); expect(onCommand.mock.calls[1]![0]).toBe(used.actions[0]!.command);
  });

  it("offers WAIT and CLOSE without resources and never locally restores the source or advances time", async () => {
    const value = opened(); value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "当前灵性不足2点，可等待或结束。" };
    const onCommand = vi.fn(); render(<FireThiefPanel fireThief={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const use = screen.getByRole("button", { name: /^使用实际借得的霜冷/ }) as HTMLButtonElement;
    expect(use.disabled).toBe(true); expect(document.getElementById(use.getAttribute("aria-describedby")!)?.textContent).toContain("灵性不足2点");
    for (const label of ["不使用能力，等待一个时段", "等待来源恢复并实际离场"]) {
      const button = screen.getByRole("button", { name: new RegExp(`^${label}`) }) as HTMLButtonElement;
      expect(button.disabled).toBe(false); expect(button.textContent).toContain("0行动 · 0精神 · 0灵性"); await userEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[1]!.command, value.actions[2]!.command]);
    expect(screen.getByText("来源失能剩余时段").parentElement?.textContent).toContain("3 个现场时段");
    expect(screen.getByText("本次实际使用次数").parentElement?.textContent).toContain("0 次");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/原持有者这项能力仍暂时失能/)).toBeTruthy();
  });

  it("selects all three stories and forwards preparation, ordinary work, withdrawal and reports exactly", async () => {
    const commands: FireThiefCommand[] = [{ type: "OBSERVE", caseId: "unknown-power" }, { type: "PREPARE", caseId: "unknown-power", method: "ORDINARY" },
      { type: "PERFORM", caseId: "unknown-power" }, { type: "WITHDRAW", caseId: "unknown-power" }, { type: "REPORT", caseId: "unknown-power" }];
    const labels = ["核对实际来源", "准备普通复核并拒绝越界", "实际核实资料", "撤回尚未执行的准备", "提交有限报告"];
    const value = fireThief({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!, true, "当前公开成本 · 0灵性")) });
    const onCommand = vi.fn(); render(<FireThiefPanel fireThief={value} resources={{ ...resources, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) { await userEvent.selectOptions(screen.getByRole("combobox"), entry.id); expect(screen.getByText(entry.story)).toBeTruthy(); }
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.queryByRole("region", { name: "有限实践与实际结果" })).toBeNull();
    expect(screen.getByRole("region", { name: "当前借用与两段时窗" }).textContent).toContain("当前没有实际借得的临时能力");
  });

  it("keeps unknown-source ability preparation disabled without inventing target abilities or identifiers", async () => {
    const reason = "没有实际高位来源，不能凭残缺旧资料补出可窃能力；请普通核实。";
    const command = action({ type: "PREPARE", caseId: "unknown-power", method: "ABILITY" }, "准备有真实来源的能力", false);
    const { onCommand } = panel(fireThief({ promoted: true, cases: cases(), samples: [], actions: [{ ...command, reason }] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "unknown-power");
    const button = screen.getByRole("button", { name: /^准备有真实来源的能力/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: /的公开来源/ })).toBeNull();
    expect(screen.queryByText(/本次实际窃得：/)).toBeNull(); expect(screen.queryByRole("button", { name: /传送|窃取神性|立即生成/ })).toBeNull();
  });

  it("locks to the enabled public CLOSE scene and limits active-contact actions to USE WAIT CLOSE", async () => {
    const value = opened(); const { onCommand, rerender } = panel(fireThief({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "unknown-power");
    const injected = [action({ type: "CLOSE", caseId: "unknown-power" }, "旧接触不可结束", false), ...value.actions,
      action({ type: "PREPARE", caseId: "borrowed-flash", method: "ORDINARY" }, "不应中途重准备"),
      action({ type: "PERFORM", caseId: "borrowed-flash" }, "不应中途重新窃取"), action({ type: "REPORT", caseId: "borrowed-flash" }, "不应提前报告"),
      action({ type: "REFLECT" }, "不应提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不应提前赴冲突")];
    rerender(<FireThiefPanel fireThief={{ ...value, actions: injected }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("borrowed-flash");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const publicAction of value.actions) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${publicAction.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(value.actions.map((entry) => entry.command));
    expect(screen.queryByRole("button", { name: /不应/ })).toBeNull(); expect(screen.getByText(firstFailure)).toBeTruthy();
  });

  it("distinguishes own expiry from source restoration and keeps closed results without synthetic actions", async () => {
    const value = opened(); const expired = { ...value, loan: { ...value.loan, playerSteps: 0, targetSteps: 1, uses: 2, elapsedSteps: 2 }, actions: value.actions.slice(1) };
    const { onCommand, rerender } = panel(expired);
    expect(screen.getByText("自身借用已到期，不能再使用这项临时能力。")).toBeTruthy();
    expect(screen.getByText(/自身到期不代表来源已恢复/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /^使用实际借得/ })).toBeNull();
    rerender(<FireThiefPanel fireThief={{ ...expired, loan: { ...expired.loan, targetSteps: 0, elapsedSteps: 3 }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("来源失能时窗已结束，原持有者这项能力已恢复。")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "盗火人成长下一步" }).textContent).toContain("查看当前公开使用、等待或结束选项");
    const result = "霜冷实际使用2次；自身临时能力到期，来源霜冷已恢复，实际离场。";
    const closed = fireThief({ promoted: true, acting: 100, digestion: "本阶段已消化", cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", result: entry.id === "borrowed-flash" ? result : null })), actions: [] });
    rerender(<FireThiefPanel fireThief={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(result)).toBeTruthy(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks busy, blocked and save-error actions while retaining actual ability and both windows", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<FireThiefPanel fireThief={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("本次实际窃得：霜冷")).toBeTruthy();
      expect(screen.getByText("自身可用剩余时段").parentElement?.textContent).toContain("2 个现场时段");
      expect(screen.getByText("来源失能剩余时段").parentElement?.textContent).toContain("3 个现场时段");
    }
    rerender(<FireThiefPanel fireThief={value} resources={resources} busy={false} error={{ message: "原保存须重新加载", retryable: false }} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^等待来源恢复并实际离场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps every real cryptologist case, failed finding, original ID and bottle read-only", () => {
    const cryptologist: CryptologistProjection = {
      title: "解密学者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: "原解密学者成品耗用记录。",
      story: "旧解密与普通核对都保留。", environment: "原量尺已经实际归还，没有凭空补全拓片。",
      cases: [
        { id: "ledger-sequence", title: "原收据顺序", story: "核对原折痕与蓝章。", status: "RESOLVED", observations: ["原失败与一次夸大报告保留。"], preparation: "有限解密后普通核实。", result: "只确认原收据先后。" },
        { id: "stage-corridor", title: "舞台假走廊", story: "实际核对原灯架与镜子。", status: "RESOLVED", observations: ["原道具员转镜后核实。"], preparation: "依据亲见原接缝核对。", result: "普通镜景造成假走廊。" },
        { id: "marked-rubbing", title: "有缺角的旧拓片", story: "只整理可见结构。", status: "RESOLVED", observations: ["原拓片仍有缺角。"], preparation: "停止未知部分解密。", result: "未补全作者、年代或原物能力。" },
      ],
      actions: [{ id: "old-reflect", label: "不应重做旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "cryptologist-old-original", title: "解密学者旧原瓶", source: "艾德温原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "cryptologist-old-original", confirmed: true } }],
      abilities: [{ id: "error.s7.decryption", label: "原有限解密", mastery: 67, description: "只核对已有原事实。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险",
    };
    render(<FireThiefCryptologistHistory cryptologist={cryptologist} />);
    const history = within(screen.getByRole("region", { name: "解密学者时期的经历" }));
    ["原案卷ID：ledger-sequence", "原案卷ID：stage-corridor", "原案卷ID：marked-rubbing", "原瓶ID：cryptologist-old-original", "原失败与一次夸大报告保留。",
      "当时的实际核实与报告：未补全作者、年代或原物能力。", "来源：艾德温原渠道", "已耗用 · 原失败保留",
      "原有限解密 · 掌握 67：只核对已有原事实。", cryptologist.environment].forEach((text) => expect(history.getByText(text)).toBeTruthy());
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不应重做旧成长")).toBeNull();
  });
});
