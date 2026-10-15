/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotaryAction, NotaryCommand, NotaryProjection } from "../../src/domain/notary/types";
import type { SunpriestProjection } from "../../src/domain/sunpriest/types";
import { NotaryPanel, NotarySunpriestHistory } from "../../src/renderer/NotaryPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections deliberately do not import state constructors or rule handlers.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const FORMULA = [
  { name: "长者之树根茎结晶", quantity: 1, unit: "份" },
  { name: "契灵鸟尾羽", quantity: 5, unit: "根" },
  { name: "光辉契灵树汁", quantity: 100, unit: "mL" },
  { name: "金边太阳花", quantity: 1, unit: "朵" },
  { name: "白边太阳花", quantity: 1, unit: "朵" },
  { name: "水蕨汁", quantity: 5, unit: "滴" },
];
const RISK = "大成功：晋升并获得本次良好状态；成功：晋升；失败：原瓶耗用且承受排异；大失败：原瓶耗用并承受严重排异。意志难度24。";
const PROMISE = "我借用原工作间桌上的这把测量工具，并在离开本次现场前亲手将同一把工具归还原桌。";
const AGREEMENT = `成年看守米菈当面同意本次借用。短契约原文：${PROMISE}本人读完并签名认可后，仍须实际实施才可能使本次契约生效；普通借用方法仍可选择。`;
function action(command: NotaryCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): NotaryAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向原指导者学习公证人配方", true, "360便士 · 1行动");
function notary(patch: Partial<NotaryProjection> = {}): NotaryProjection {
  return {
    title: "公证人晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "太阳神官扮演100，已度过12/12个完整序列7周。", pollution: 3, risk: RISK,
    cases: [], insideCase: false, environment: "",
    contract: { signed: false, active: false, tool: "TABLE", fulfilled: false },
    ...patch,
  };
}
function cases(): NotaryProjection["cases"] {
  return [
    { id: "limited-light", title: "原微光能力的有限公证", story: "核对本人原有微光能力与普通灯具，未获得任意新能力。" },
    { id: "rejected-terms", title: "原拒绝与后续窄责", story: "看守保留拒绝不公平条款的权利；后续修订另行核对。" },
    { id: "signed-tool", title: "本人签名的原工具短约", story: AGREEMENT },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function bottled(): NotaryProjection {
  return notary({ formulaKnown: true, formula: FORMULA,
    actions: ["notary-batch-1:bottle", "notary-batch-2:bottle"].map((bottleId) => action(
      { type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: [
      { id: "notary-batch-1:bottle", title: "第一瓶公证人魔药", source: "第一批六项实际原料，五步劳务后独立调配", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "notary-batch-1:bottle", confirmed: true } },
      { id: "notary-batch-2:bottle", title: "第二瓶公证人魔药", source: "第二批六项实际采购原料的独立调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "notary-batch-2:bottle", confirmed: true } },
    ],
  });
}
function panel(value: NotaryProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<NotaryPanel notary={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function signAction() {
  return action({ type: "SIGN", caseId: "signed-tool" }, "本人签名并明确认可原工具归还短约", true, "0行动 · 0灵性 · 明确认可上方承诺");
}
function signable(): NotaryProjection {
  return notary({ promoted: true, cases: cases(), actions: [signAction(),
    action({ type: "PREPARE", caseId: "signed-tool", method: "ORDINARY" }, "选择普通借用方法", true, "1行动 · 不建立非凡契约")],
  });
}
afterEach(cleanup);

describe("Notary public originals, explicit recognition and actual return", () => {
  it("uses only the public maturity gate and never reveals an unknown formula", () => {
    const reason = "太阳神官扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const { onCommand } = panel(notary({ digestion: reason, formula: FORMULA, actions: [{ ...learn, enabled: false, reason }] }));
    expect(screen.getByRole("region", { name: "公证人成长下一步" }).textContent).toContain(reason);
    const button = screen.getByRole("button", { name: /^向原指导者学习/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("长者之树根茎结晶")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the complete six-material public formula with exact amounts and no invented order", () => {
    const supplies = "原六料仍由指导者保管；本批完成4/5步劳务，主材3000便士、辅料240便士，未取得且未调配。";
    const { onCommand } = panel(notary({ formulaKnown: true, formula: FORMULA, supplies }));
    const formula = within(screen.getByLabelText("公证人已知配方"));
    expect(formula.getAllByRole("listitem", { hidden: true })).toHaveLength(6);
    for (const material of FORMULA) {
      const row = formula.getByText(material.name).closest("li")!;
      expect(within(row).getByText(`${material.quantity} ${material.unit}`)).toBeTruthy();
    }
    expect(formula.getByText(/材料清单不等于投料顺序/)).toBeTruthy();
    expect(screen.getByText(supplies)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards each public acquisition step and actual batch without manufacturing a bottle", async () => {
    const commands: NotaryCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "notary-batch-2" },
      { type: "BUY_MATERIALS", batchId: "notary-batch-2" }, { type: "BREW", batchId: "notary-batch-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["学习已知配方", "完成本批第五步劳务", "取得原六料", "调配第二批原料", "请求下一批供货", "领取实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "240便士 · 0行动", "80便士 · 1行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(notary({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each bottle at zero AP with Escape or the cancel button and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶公证人魔药」" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶公证人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶公证人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶公证人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第二瓶公证人魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected original, full four-tier risk and actual resources before confirming it exactly once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶公证人魔药」" }));
    expect(screen.getByText("notary-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：第二批六项实际采购原料的独立调配记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "公证人服用风险与四档结果" }).textContent).toContain(RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶公证人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "notary-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps a confirmed bottle locked through a save failure and leaves retry to the parent", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶公证人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶公证人魔药」" }));
    const error = { message: "本次保存失败，可重试同一操作。", retryable: true };
    rerender(<NotaryPanel notary={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "这瓶公证人魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("请使用保存错误处的重试操作");
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶公证人魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("notary-batch-1:bottle")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<NotaryPanel notary={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    const committed = { ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原瓶已耗用 · 已晋升" } : bottle) };
    rerender(<NotaryPanel notary={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶公证人魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗用 · 已晋升")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("retains the failed consumed bottle as history while separately confirming another actual bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶公证人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶公证人魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<NotaryPanel notary={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶公证人魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶公证人魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶公证人魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(value.actions.map((entry) => entry.command));
  });

  it("separates ability and ordinary preparation from actual execution without changing tool custody or consent", async () => {
    const commands: NotaryCommand[] = [{ type: "OBSERVE", caseId: "limited-light" },
      { type: "PREPARE", caseId: "limited-light", method: "ABILITY" },
      { type: "PREPARE", caseId: "limited-light", method: "ORDINARY" },
      { type: "PERFORM", caseId: "limited-light" }, { type: "REPORT", caseId: "limited-light" }];
    const labels = ["核对本人已有微光", "准备有限能力公证", "准备普通灯具对照", "实际执行本次方法", "如实报告本次结果"];
    const { onCommand } = panel(notary({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.queryByRole("region", { name: "公证人实际结果" })).toBeNull();
    expect(screen.getByText("原工作间桌上")).toBeTruthy(); expect(screen.getByText("尚未签名认可")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows the original caretaker refusal, then the later narrow-duty revision without erasing that refusal", async () => {
    const refusal = "米菈明确拒绝原条款：不能把所有损失都推给看守。原不公平条款没有生效。";
    const revision = "下一周米菈只同意本次清点桌面原物的窄责；原拒绝保留。";
    const original = cases().map((entry) => entry.id === "rejected-terms" ? { ...entry, status: "EXAMINED", observations: [refusal], result: "原要求遭拒，未建立契约。" } : entry);
    const value = notary({ promoted: true, cases: original, actions: [action({ type: "REPORT", caseId: "rejected-terms" }, "记录这次原拒绝")] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText("原要求遭拒，未建立契约。")).toBeTruthy();
    const revised = { ...value, cases: original.map((entry) => entry.id === "rejected-terms" ? { ...entry, status: "OBSERVED", observations: [refusal, revision], result: null } : entry),
      actions: [action({ type: "PREPARE", caseId: "rejected-terms", method: "ORDINARY" }, "选择本次窄责的普通核对")] };
    rerender(<NotaryPanel notary={revised} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText(revision)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^选择本次窄责/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(revised.actions[0]!.command);
    expect(screen.getByText("尚未签名认可")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /强迫|自动接受/ })).toBeNull();
  });

  it("requires reading and explicit player recognition of the exact short promise before public SIGN", async () => {
    const { onCommand } = panel(signable());
    const current = within(screen.getByRole("region", { name: "当前公证人实践" }));
    expect(current.getByText(AGREEMENT)).toBeTruthy(); expect(current.getByText(AGREEMENT).textContent).toContain(PROMISE);
    const checkbox = screen.getByRole("checkbox", { name: "我已阅读本次短契约，愿意以本人签名明确认可。" }) as HTMLInputElement;
    const sign = screen.getByRole("button", { name: /^本人签名并明确认可原工具归还短约/ }) as HTMLButtonElement;
    expect(checkbox.checked).toBe(false); expect(sign.disabled).toBe(true);
    fireEvent.click(sign); expect(onCommand).not.toHaveBeenCalled();
    checkbox.focus(); await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(true); expect(sign.disabled).toBe(false); expect(onCommand).not.toHaveBeenCalled();
    sign.focus(); await userEvent.keyboard("{Enter}"); fireEvent.click(sign);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SIGN", caseId: "signed-tool" });
    expect(screen.getByText("尚未签名认可")).toBeTruthy(); expect(screen.getByText("原工作间桌上")).toBeTruthy();
    expect(sign.disabled).toBe(true);
  });

  it("keeps the ordinary method usable without checking agreement or sending SIGN", async () => {
    const { onCommand } = panel(signable());
    await userEvent.click(screen.getByRole("button", { name: /^选择普通借用方法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE", caseId: "signed-tool", method: "ORDINARY" });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("尚未签名认可")).toBeTruthy(); expect(screen.getByText("当前没有生效中的契约义务")).toBeTruthy();
  });

  it("requires fresh recognition after the visible contract text changes", async () => {
    const value = signable(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("checkbox"));
    const changed = { ...value, cases: value.cases.map((entry) => entry.id === "signed-tool" ? { ...entry, story: `${AGREEMENT}本次原桌位置已当面重新核对。` } : entry) };
    rerender(<NotaryPanel notary={changed} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("button", { name: /^本人签名并明确认可/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps submitted SIGN tied to the same saved record through a parent-owned retry", async () => {
    const value = signable(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /^本人签名并明确认可/ }));
    rerender(<NotaryPanel notary={value} resources={resources} busy={false} error={{ message: "签名保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByText(AGREEMENT)).toBeTruthy(); expect(screen.getByText("尚未签名认可")).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^本人签名并明确认可/ }));
    const committed = { ...value, contract: { ...value.contract, signed: true, active: false }, actions: [] };
    rerender(<NotaryPanel notary={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已明确签名认可本次短契约")).toBeTruthy(); expect(screen.getByText("当前没有生效中的契约义务")).toBeTruthy();
    expect(screen.getByText("原工作间桌上")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows actual PLAYER custody after committed practice and only clears obligation on committed CLOSE", async () => {
    const close = action({ type: "CLOSE", caseId: "signed-tool" }, "亲手归还同一把原测量工具并离场", true, "0行动 · 0精神 · 0灵性");
    const value = notary({ promoted: true, insideCase: true, contract: { signed: true, active: true, tool: "PLAYER", fulfilled: false },
      cases: cases().map((entry) => entry.id === "signed-tool" ? { ...entry, status: "EXAMINED", result: "实际借到了这把原测量工具；归还承诺仍待履行。", contactOpen: "仍在原工作间" } : entry), actions: [close] });
    const onCommand = vi.fn();
    const { rerender } = render(<NotaryPanel notary={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("signed-tool"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本人实际持有")).toBeTruthy(); expect(screen.getByText("本次归还承诺仍有效")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^亲手归还同一把原测量工具并离场/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "signed-tool" });
    expect(screen.getByText("本人实际持有")).toBeTruthy(); expect(screen.getByText("本次归还承诺仍有效")).toBeTruthy();
    const committed = { ...value, insideCase: false, contract: { signed: true, active: false, tool: "TABLE" as const, fulfilled: true }, actions: [],
      cases: value.cases.map((entry) => entry.id === "signed-tool" ? { ...entry, contactOpen: "已实际归还并离场", closes: 1 } : entry) };
    rerender(<NotaryPanel notary={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原工作间桌上")).toBeTruthy(); expect(screen.getByText("当前没有生效中的契约义务")).toBeTruthy();
    expect(screen.getByText("已经实际归还并履行本次承诺")).toBeTruthy();
    expect(screen.getByText("已明确签名认可本次短契约")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
  });

  it("keeps ordinary tool custody separate from supernatural agreement and preserves actual failure on exit", async () => {
    const close = action({ type: "CLOSE", caseId: "signed-tool" }, "实际归还普通借用的原工具", true, "0行动 · 0灵性");
    const failure = "原非凡尝试失败；后续只完成普通借用，没有签订非凡契约。";
    const { onCommand } = panel(notary({ promoted: true, insideCase: true, contract: { signed: false, active: false, tool: "PLAYER", fulfilled: false },
      cases: cases().map((entry) => entry.id === "signed-tool" ? { ...entry, result: failure } : entry), actions: [close] }));
    expect(screen.getByText("本人实际持有")).toBeTruthy(); expect(screen.getByText("尚未签名认可")).toBeTruthy();
    expect(screen.getByText("当前没有生效中的契约义务")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际归还普通借用/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command); expect(screen.getByText(failure)).toBeTruthy();
  });

  it("does not treat withdrawal or reopening the panel as signature, return, fulfillment or new rewards", async () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "limited-light" }, "撤回本次公证准备", true, "0行动 · 0灵性");
    const value = notary({ promoted: true, cases: cases(), contract: { signed: true, active: true, tool: "PLAYER", fulfilled: false }, actions: [withdraw] });
    const { onCommand, unmount } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^撤回本次公证准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByText("本人实际持有")).toBeTruthy(); expect(screen.getByText("本次归还承诺仍有效")).toBeTruthy();
    unmount(); panel(value, onCommand);
    expect(screen.getByText("本人实际持有")).toBeTruthy(); expect(screen.getByText("本次归还承诺仍有效")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("obeys public disabled reasons, busy, external blocking and save errors without inventing an AP gate", () => {
    const close = { ...action({ type: "CLOSE", caseId: "signed-tool" }, "实际结束本次现场", false, "0行动"), reason: "当前正在保存原操作。" };
    const value = notary({ promoted: true, cases: cases(), insideCase: true, actions: [close] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(close.reason)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^实际结束本次现场/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^实际结束本次现场/ }));
    const enabled = { ...value, actions: [{ ...close, enabled: true, reason: null }] };
    rerender(<NotaryPanel notary={enabled} resources={resources} busy onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^实际结束本次现场/ }));
    rerender(<NotaryPanel notary={enabled} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^实际结束本次现场/ }));
    rerender(<NotaryPanel notary={enabled} resources={resources} busy={false} error={{ message: "无法保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(screen.getByRole("button", { name: /^实际结束本次现场/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders inherited and new abilities as records and forwards only actual public encounter actions", async () => {
    const abilities = [
      { id: "sun.s7.holy-water", label: "原有圣水制造", mastery: 120, description: "沿用原有制备与真实消耗记录。" },
      { id: "sun.s6.notarization", label: "有限能力公证", mastery: 20, description: "有限强化或削弱已有能力。" },
      { id: "sun.s6.signed-contract", label: "签名认可的契约", mastery: 0, description: "须本人签名认可本次约定。" },
    ];
    const talk = action({ type: "ENCOUNTER_TALK" }, "当面解释原工具去向", true, "1行动 · 普通交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担风险面对真实冲突", true, "1行动 · 可以实际撤退");
    const { onCommand } = panel(notary({ promoted: true, abilities, acting: 42, actions: [talk, fight] }));
    const records = within(screen.getByRole("region", { name: "公证人能力与消化" }));
    for (const ability of abilities) expect(records.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(records.queryAllByRole("button")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /^当面解释原工具去向/ }));
    await userEvent.click(screen.getByRole("button", { name: /^承担风险面对真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /创造能力|改写现实|强制契约/ })).toBeNull();
  });

  it("retains sunpriest original bottles, voluntary promises, actual holy-water use and failures as read-only history", () => {
    const sunpriest: SunpriestProjection = {
      title: "太阳神官旧卷宗", discovered: true, promoted: true, formulaKnown: true,
      formula: [{ name: "黎明雄鸡红冠", quantity: 1, unit: "朵" }],
      actions: [{ id: "old-action", label: "不可重做的旧实践", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
      bottles: [{ id: "old-sunpriest-bottle", title: "太阳神官原瓶", source: "原批次六料", status: "原瓶已耗用，第一次失败保留", chance: 43, command: { type: "CONSUME", bottleId: "old-sunpriest-bottle", confirmed: true } }],
      cases: [{ id: "isolation-cleanup", title: "原隔离空壳清理", status: "RESOLVED", story: "原清理故事。", observations: ["原微弱异常实际可见。"], preparation: "原圣水一份，实际用于本次尝试。", result: "原处理失败且圣水耗尽，随后普通转交完成。" }],
      abilities: [{ id: "sun.s7.holy-water", label: "原有圣水制造", mastery: 120, description: "原圣水已耗用。" }],
      supplies: "原圣水制备1份、实际耗用1份；没有剩余原瓶。", environment: "原值夜人当时自愿认可本次承诺。",
      acting: 100, digestion: "太阳神官时期已完成消化。", pollution: 3, risk: "旧服药风险", story: "原材料与原圣水记录保留。",
    };
    render(<NotarySunpriestHistory sunpriest={sunpriest} />);
    const history = within(screen.getByRole("region", { name: "太阳神官时期的经历" }));
    expect(history.getByText("太阳神官扮演进度 100 · 消化：太阳神官时期已完成消化。")).toBeTruthy();
    for (const text of ["原材料与原圣水记录保留。", "原圣水制备1份、实际耗用1份；没有剩余原瓶。", "原值夜人当时自愿认可本次承诺。", "原微弱异常实际可见。", "来源：原批次六料", "原瓶已耗用，第一次失败保留", "黎明雄鸡红冠"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText("当时的准备：原圣水一份，实际用于本次尝试。")).toBeTruthy();
    expect(history.getByText("当时的实际结果：原处理失败且圣水耗尽，随后普通转交完成。")).toBeTruthy();
    expect(history.getByText("原有圣水制造 · 掌握 120：原圣水已耗用。")).toBeTruthy();
    expect(history.queryAllByRole("button")).toHaveLength(0); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByRole("checkbox")).toBeNull();
  });
});
