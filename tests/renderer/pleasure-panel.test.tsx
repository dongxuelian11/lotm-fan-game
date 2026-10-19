/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PleasureAction, PleasureCommand, PleasureProjection } from "../../src/domain/pleasure/types";
import type { WitchProjection } from "../../src/domain/witch/types";
import { PleasurePanel, PleasureWitchHistory } from "../../src/renderer/PleasurePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections check UI intent handling, never calculate domain outcomes.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const FORMULA: PleasureProjection["formula"] = [
  { name: "魅欲女妖眼睛", quantity: 1, unit: "对" }, { name: "成年寡妇巨蛛丝腺", quantity: 1, unit: "个" },
  { name: "纯水", quantity: 100, unit: "mL" }, { name: "黑色曼陀罗汁", quantity: 5, unit: "滴" },
  { name: "魅欲女妖残留全部毛发", quantity: null, unit: "全部", note: "实际原物以一份封装记录，原文未给克重。" },
  { name: "费内波特苍蝇粉", quantity: 10, unit: "g" }, { name: "真正木乃伊骨灰", quantity: 5, unit: "g" },
];
const risk = "大成功与成功可晋升；失败与灾难消耗这一原瓶，并保留排异、污染与伤势。本作G严重排异可恢复，不以原药失败即死。";
const bodyChange = "角色已在女巫7阶段完成身体变化；欢愉6不再次改变身体性别。";
function action(command: PleasureCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PleasureAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向原指导者学习欢愉配方", true, "360便士 · 1行动");
function pleasure(patch: Partial<PleasureProjection> = {}): PleasureProjection {
  return {
    title: "欢愉晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "女巫扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", inheritedTools: "", bodyChange,
    practice: { wrist: "FREE", wristConsent: false, invitationWilling: false, fireSilk: "NONE", fireBreak: "NONE" },
    ...patch,
  };
}
function cases(): PleasureProjection["cases"] {
  return [
    { id: "silk-release", title: "腕部丝线与实际释放", story: "成年志愿者可同意短暂腕部练习，也可随时要求实际停止。" },
    { id: "refused-invitation", title: "一份被拒绝的邀请", story: "成年当事人已拒绝原邀请，魅惑不能替她同意；普通交谈保留。" },
    { id: "fire-break", title: "原练习框上的断丝", story: "原丝须先实际架在空框上，再使用黑焰或原剪刀尝试断开。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): PleasureProjection {
  const originals = [
    { id: "pleasure-batch-1:bottle", title: "第一瓶欢愉魔药", source: "第一批七项实际原料，五步劳务后独立调配", chance: 71 },
    { id: "pleasure-batch-2:bottle", title: "第二瓶欢愉魔药", source: "第二批七项实际采购原料的独立调配记录", chance: 43 },
  ];
  return pleasure({ formulaKnown: true, formula: FORMULA, supplies: "每瓶对应原七料与独立调配记录。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): PleasureProjection["bottles"][number] => ({ ...bottle, status: "已调配，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalRefusal = "她当面拒绝了原邀请，之后仍未同意；原拒绝不可抹去。";
function opened(): PleasureProjection {
  return pleasure({ promoted: true, insideCase: true,
    practice: { ...pleasure().practice, wrist: "SILK", wristConsent: true },
    cases: cases().map((entry) => entry.id === "silk-release" ? {
      ...entry, status: "EXAMINED", observations: ["已核对本人成年、自愿同意与停止信号。"],
      preparation: "准备本次短暂腕部丝线。", result: "已实际接触，收到停止信号后须实际释放。", contactOpen: "本次接触尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "silk-release" }, "释放原丝并实际结束本次接触", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: PleasureProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PleasurePanel pleasure={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Pleasure public materials, voluntary contact and actual release", () => {
  it("shows the public maturity gate and keeps the unknown recipe hidden", () => {
    const reason = "女巫扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const { onCommand } = panel(pleasure({ digestion: reason, formula: FORMULA, actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "欢愉成长下一步" });
    expect(summary.textContent).toContain(reason); expect(summary.textContent).toContain("准备期间仍可继续普通生活");
    const button = screen.getByRole("button", { name: /^向原指导者学习/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    expect(screen.queryByText("魅欲女妖眼睛")).toBeNull(); expect(screen.queryByRole("button", { name: /直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all seven known materials without inventing hair grams or a brewing order", () => {
    const supplies = "本批七项原料仍由供应者保管；劳务4/5，女妖全部残留毛发原物1份，尚未取得或调配。";
    panel(pleasure({ formulaKnown: true, formula: FORMULA, supplies }));
    const formula = screen.getByLabelText("欢愉已知配方");
    expect((formula as HTMLDetailsElement).open).toBe(false);
    expect(within(formula).getAllByRole("listitem", { hidden: true })).toHaveLength(7);
    for (const material of FORMULA) {
      const row = within(formula).getByText(material.name).closest("li")!;
      expect(within(row).getByText(`${material.quantity === null ? "" : `${material.quantity} `}${material.unit}`)).toBeTruthy();
    }
    expect(formula.textContent).toContain("不换算成未知克重"); expect(formula.textContent).toContain("材料清单不等于投料顺序");
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("forwards the exact public acquisition batch and cost without creating an original locally", async () => {
    const commands: PleasureCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "pleasure-batch-2" },
      { type: "BUY_MATERIALS", batchId: "pleasure-batch-2" }, { type: "BREW", batchId: "pleasure-batch-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "BUY_SUPPLIES" }, { type: "PREPARE_MIRROR" }];
    const labels = ["学习配方", "完成本批第五步劳务", "取得原七料", "调配第二批原料", "请求下一批供货", "领取实际到货", "补充原镜片粉末", "准备现有原镜片"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "240便士 · 0行动", "80便士 · 1行动", "1行动 · 下周到货", "0行动", "60便士 · 1行动", "0行动 · 0灵性 · 本次不碎镜"];
    const { onCommand } = panel(pleasure({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each bottle at zero AP with keyboard focus returned to that original", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶欢愉魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶欢愉魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第二瓶欢愉魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows selected source, recoverable four-tier risk and resources before confirming once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶欢愉魔药」" }));
    expect(screen.getByText("pleasure-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：第二批七项实际采购原料的独立调配记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "欢愉服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText(bodyChange)).toBeTruthy(); expect(screen.queryByRole("checkbox")).toBeNull();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶欢愉魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "pleasure-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("region", { name: "欢愉能力与消化" })).toBeNull();
  });

  it("reads updated eligibility, risk and resources while confirmation is open", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" }));
    const reason = "当前精神不足，请先休养。";
    const updated = { ...value, risk: "当前污染变化，按最新四档风险结算。", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 19 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<PleasurePanel pleasure={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶欢愉魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the original confirmation during failed-save same-intent retry and loading", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欢愉魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<PleasurePanel pleasure={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欢愉魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("pleasure-batch-1:bottle")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<PleasurePanel pleasure={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "这瓶欢愉魔药的服用确认" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("keeps a committed failed bottle and independently offers the remaining original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶欢愉魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<PleasurePanel pleasure={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶欢愉魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶欢愉魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("pleasure-batch-2:bottle")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("closes confirmation on saved promotion while preserving the original and prior body change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶欢愉魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶欢愉魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 1 ? { ...bottle, status: "原瓶已耗用 · 已晋升欢愉" } : bottle) };
    rerender(<PleasurePanel pleasure={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶欢愉魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "欢愉能力与消化" })).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升欢愉")).toBeTruthy();
    expect(screen.getByText(bodyChange)).toBeTruthy(); expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("navigates all three public cases and forwards methods without optimistic contact", async () => {
    const commands: PleasureCommand[] = [{ type: "OBSERVE", caseId: "silk-release" }, { type: "PREPARE", caseId: "silk-release", method: "ORDINARY" },
      { type: "PREPARE", caseId: "silk-release", method: "ABILITY" }, { type: "PERFORM", caseId: "silk-release" },
      { type: "WITHDRAW", caseId: "silk-release" }, { type: "REPORT", caseId: "silk-release" }];
    const labels = ["核对本人意见与停止信号", "准备普通绳圈", "准备有限丝线", "实际进行本次接触", "撤回待执行准备", "提交本次有限报告"];
    const value = pleasure({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value); expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "silk-release");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    const facts = screen.getByRole("region", { name: "已保存的接触与原丝记录" });
    expect(facts.textContent).toContain("尚无当事人对本次腕部练习的同意记录"); expect(facts.textContent).toContain("已无丝线或绳圈接触");
    expect(screen.queryByRole("region", { name: "欢愉实际结果" })).toBeNull();
  });

  it("pins actual contact to public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(pleasure({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "fire-break"); const value = opened();
    rerender(<PleasurePanel pleasure={{ ...value, actions: [action({ type: "CLOSE", caseId: "fire-break" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "silk-release" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "silk-release" }, "不可撤回代替释放"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("silk-release"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^释放原丝并实际结束本次接触/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "silk-release" });
    expect(screen.getByText(/当前腕部：实际丝线接触仍在/)).toBeTruthy(); expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("releases actual silk only after a saved public CLOSE and retains the old practice result", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^释放原丝并实际结束本次接触/ }));
    expect(screen.getByText(/当前腕部：实际丝线接触仍在/)).toBeTruthy();
    rerender(<PleasurePanel pleasure={{ ...value, insideCase: false, actions: [], practice: { ...value.practice, wrist: "FREE" },
      cases: value.cases.map((entry) => entry.id === "silk-release" ? { ...entry, contactOpen: "本次接触已实际结束", closes: 1 } : entry),
    }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(/当前腕部：已无丝线或绳圈接触/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "欢愉实际结果" }).textContent).toContain("收到停止信号后须实际释放");
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("does not invent CLOSE or infer renewed contact from old prose", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "欢愉成长下一步" }).textContent).toContain("查看当前公开结束选项");
    rerender(<PleasurePanel pleasure={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "refused-invitation");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the original refusal, disabled ability reason and ordinary alternative distinct", async () => {
    const reason = "原邀请已被拒绝，不能用魅惑替她同意。";
    const ordinary = action({ type: "PREPARE", caseId: "refused-invitation", method: "ORDINARY" }, "准备普通交谈", true, "1行动 · 不改变原拒绝");
    const value = pleasure({ promoted: true, cases: cases().map((entry) => entry.id === "refused-invitation" ? { ...entry, observations: [originalRefusal] } : entry),
      actions: [{ ...action({ type: "PREPARE", caseId: "refused-invitation", method: "ABILITY" }, "不可魅惑原拒绝", false), reason }, ordinary] });
    const { onCommand } = panel(value);
    const blocked = screen.getByRole("button", { name: /^不可魅惑原拒绝/ }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true); expect(document.getElementById(blocked.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(blocked); await userEvent.click(screen.getByRole("button", { name: /^准备普通交谈/ }));
    expect(screen.getByText(originalRefusal)).toBeTruthy(); expect(screen.getByText("当事人当前未同意本次邀请。")).toBeTruthy();
    expect(screen.getByText(/受影响不等于同意/)).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("forwards separate original-silk creation and reads fire breaking only from saved facts", async () => {
    const spin = action({ type: "SPIN_SILK", caseId: "fire-break" }, "实际在空框建立原丝", true, "1行动 · 3灵性");
    const flame = action({ type: "PERFORM", caseId: "fire-break" }, "实际用黑焰尝试断丝", true, "1行动 · 3灵性");
    const value = pleasure({ promoted: true, cases: cases(), actions: [spin, flame] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际在空框建立原丝/ }));
    expect(screen.getByText("同一原丝：尚未实际建立")).toBeTruthy();
    rerender(<PleasurePanel pleasure={{ ...value, practice: { ...value.practice, fireSilk: "ON_FRAME" } }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际用黑焰尝试断丝/ }));
    expect(screen.getByText("同一原丝：已实际架在练习框上")).toBeTruthy();
    rerender(<PleasurePanel pleasure={{ ...value, practice: { ...value.practice, fireSilk: "BROKEN", fireBreak: "BLACK_FLAME" } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原丝：已实际断开，断丝仍待清理")).toBeTruthy(); expect(screen.getByText("实际断开方式：黑焰")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([spin.command, flame.command]);
  });

  it("retains ordinary scissors as the actual break method after cleanup and peaceful 100", async () => {
    const value = pleasure({ promoted: true, cases: cases(), acting: 100, digestion: "本作G和平路线已消化", actions: [],
      practice: { ...pleasure().practice, fireSilk: "CLEARED", fireBreak: "SCISSORS" } });
    panel(value); await userEvent.selectOptions(screen.getByRole("combobox"), "fire-break");
    expect(screen.getByText("同一原丝：已实际清理")).toBeTruthy(); expect(screen.getByText("实际断开方式：普通剪刀")).toBeTruthy();
    expect(screen.queryByText("实际断开方式：黑焰")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "欢愉扮演进度" }).getAttribute("value")).toBe("100");
    expect(screen.getByText("扮演进度 100 · 消化：本作G和平路线已消化")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("blocks busy, external blocking and save failures without hiding committed contact", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<PleasurePanel pleasure={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(/当前腕部：实际丝线接触仍在/)).toBeTruthy();
    }
    rerender(<PleasurePanel pleasure={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps boundaries folded, shows only public mastery and preserves inherited tool costs", () => {
    const abilities = [{ id: "assassin.s6.silk", label: "有限丝线", mastery: 23, description: "须实际建立接触，受到干扰会断开。" }];
    panel(pleasure({ promoted: true, cases: cases(), abilities, actions: [], inheritedTools: "原镜片已耗用1片，当前未准备镜替。" }));
    expect(screen.getByText("有限丝线 · 掌握 23")).toBeTruthy();
    const boundary = screen.getByLabelText("欢愉实践边界"); expect((boundary as HTMLDetailsElement).open).toBe(false);
    for (const text of ["成年人", "本人的自愿同意", "魅惑不是绝对服从", "原拒绝不能被魅惑改写", "和平消化100是本阶段的替代路线", "不代表完整亲密扮演", "本阶段不提供序列5的疾病能力"]) expect(boundary.textContent).toContain(text);
    for (const marker of ["本作原创G", "原著", "尚未开放"]) expect(boundary.textContent).not.toContain(marker);
    expect(screen.getByText("原镜片已耗用1片，当前未准备镜替。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /免费镜替|自动同意|必须亲密/ })).toBeNull();
  });

  it("forwards only public encounter choices without implying consent or victory", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "尝试当面交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担真实冲突", true, "1行动 · 真实战斗风险");
    const { onCommand } = panel(pleasure({ promoted: true, cases: cases(), actions: [talk, fight], environment: "现场公开退路仍可见。" }));
    expect(screen.getByText("现场公开退路仍可见。")).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "欢愉有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^尝试当面交涉/ })); await userEvent.click(encounter.getByRole("button", { name: /^承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /强制同意|保证胜利/ })).toBeNull();
  });

  it("preserves S7 original IDs, doses, body change, tools and failures as read-only history", () => {
    const witch: WitchProjection = {
      title: "女巫", discovered: true, formulaKnown: true, promoted: true,
      formula: [{ name: "原女巫全血", quantity: null, unit: "全部", note: "未给原克重" }],
      supplies: "原女巫七料与耗用记录保留。", story: "原女巫实践已完成。", environment: "原粉末与镜片按原记录保留。",
      tools: "镜片原件已耗用，原粉末剩余2份。", bodyChange, previousGender: "男",
      cases: [{ id: "mirror-echo", title: "原镜面回声", story: "第一次镜替练习失败，实际消耗保留。", status: "RESOLVED",
        observations: ["已核对原镜片和真实回声。"], preparation: "只使用同一原镜片。", result: "原镜片已实际破裂并完成复核。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "witch-old", title: "女巫旧原瓶", source: "女巫原独立调配记录", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "witch-old", confirmed: true, bodyChangeAccepted: true } }],
      abilities: [{ id: "assassin.s7.substitute", label: "原镜替", mastery: 67, description: "保留实际耗用原镜片的记录。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<PleasureWitchHistory witch={witch} />);
    const history = within(screen.getByRole("region", { name: "女巫时期的经历" }));
    for (const text of ["第一次镜替练习失败，实际消耗保留。", "已核对原镜片和真实回声。", "原案卷ID：mirror-echo", "原瓶ID：witch-old",
      "当时的方式与准备：只使用同一原镜片。", "当时的实际结果与报告：原镜片已实际破裂并完成复核。", "来源：女巫原独立调配记录", "已耗用 · 原失败保留",
      "原镜替 · 掌握 67：保留实际耗用原镜片的记录。", witch.environment, witch.tools, bodyChange, "全部", "未给原克重"]) expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
