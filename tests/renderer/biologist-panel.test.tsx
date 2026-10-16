/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BiologistAction, BiologistCommand, BiologistProjection } from "../../src/domain/biologist/types";
import type { HarvestpriestProjection } from "../../src/domain/harvestpriest/types";
import { BiologistPanel, BiologistHarvestpriestHistory } from "../../src/renderer/BiologistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: BiologistCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): BiologistAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取生物学家成品用药指导", true, "360便士 · 1行动");
function biologist(patch: Partial<BiologistProjection> = {}): BiologistProjection {
  return {
    title: "生物学家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "丰收祭司扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: { sampleRecorded: false, warningsRecorded: false },
    trial: { careWeek: null, verifiedWeek: null, waterUsed: 0, location: "BENCH", status: "IDLE" },
    water: { held: 2, used: 1, summary: "沿用丰收祭司原库存：剩余2份水，累计实际用水1份。" }, ...patch,
  };
}
function cases(): BiologistProjection["cases"] {
  return [
    { id: "sample-record", title: "原封样本观察记录", story: "伊芙提供同一原封样本，只记录可见事实，样本仍原封。" },
    { id: "paired-seedling", title: "同原苗有限对照", story: "在同一温室原台观察两株原苗，实际用水后须等待下一真实周亲自复核。" },
    { id: "safe-return", title: "警告与同原苗归还", story: "核对有限结论与未知警告后，把同一原苗当面交回原主伊芙。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): BiologistProjection {
  const originals = [
    { id: "biologist-potion-1", title: "第一瓶生物学家魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "biologist-potion-2", title: "第二瓶生物学家魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "biologist-potion-3", title: "第三瓶生物学家魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return biologist({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "原判断失败，已经支付的灵性与本次风险保留。";
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(caseId = "paired-seedling"): BiologistProjection {
  return biologist({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本次实际结果已记录，现场仍需实际结束。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "结束本次实践，回到生活", true, zeroClose)],
  });
}
function panel(value: BiologistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BiologistPanel biologist={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Biologist original specimens, actual verification and saved intents", () => {
  it("shows S7 maturity, actual prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "丰收祭司扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(biologist({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "生物学家成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "当前渠道只提供有来源的独立成品，不提供完整晋升配方、材料与剂量；不展示虚构材料，也不开放晋升魔药调配。"])
      expect(summary.textContent).toContain(text);
    expect(summary.textContent).not.toContain("尚未核实");
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取生物学家成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: BiologistCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "biologist-potion-3" },
      { type: "BUY_POTION", bottleId: "biologist-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(biologist({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /^查看并准备服用「第一瓶生物学家魔药」/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶生物学家魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶生物学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶生物学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶生物学家魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶生物学家魔药」/ }));
    expect(screen.getByText("biologist-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "生物学家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶生物学家魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "biologist-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶生物学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶生物学家魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<BiologistPanel biologist={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶生物学家魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("biologist-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<BiologistPanel biologist={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<BiologistPanel biologist={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶生物学家魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶生物学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶生物学家魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<BiologistPanel biologist={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^查看并准备服用「第一瓶生物学家魔药」/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶生物学家魔药」/ }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("biologist-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶生物学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶生物学家魔药」" }));
    const promoted = { ...value, title: "生物学家", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升生物学家" } : bottle) };
    rerender(<BiologistPanel biologist={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶生物学家魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升生物学家")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes same-title original bottles and submits the selected stable ID only once", async () => {
    const value = bottled();
    value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "生物学家成品魔药" }));
    const { onCommand } = panel(value);
    const second = screen.getByRole("button", { name: "查看并准备服用「生物学家成品魔药」 · 原瓶 biologist-potion-2" });
    await userEvent.click(second);
    expect(screen.getByText("biologist-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.queryByText("biologist-potion-1")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「生物学家成品魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "biologist-potion-2", confirmed: true });
  });

  it("shows the three distinct practices and sends only their projected methods", async () => {
    const commands: BiologistCommand[] = [
      { type: "OBSERVE", caseId: "sample-record" }, { type: "PREPARE", caseId: "sample-record", method: "ORDINARY" },
      { type: "PREPARE", caseId: "sample-record", method: "ABILITY" }, { type: "PERFORM", caseId: "sample-record" },
      { type: "WITHDRAW", caseId: "sample-record" }, { type: "REPORT", caseId: "sample-record" },
    ];
    const labels = ["观察原封样本", "准备普通记录", "准备有限样本研究", "实际记录原样本", "撤回本次准备", "提交本次有限报告"];
    const { onCommand } = panel(biologist({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "sample-record");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.queryByRole("region", { name: "生物学家实际结果" })).toBeNull();
    expect(screen.getByText("原封样本：尚未完成本次有限观察记录，样本仍原封保存")).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前消耗水");
  });

  it("uses only the shared original water projection and never fabricates a buy or verify command", async () => {
    const water = { held: 0, used: 3, summary: "原丰收库存剩余0份；旧照护与本次失败合计实用3份，尚无补水。" };
    const buy = action({ type: "BUY_WATER" }, "补充原植床的水", true, "30便士 · 实到2份原水");
    const value = biologist({ promoted: true, cases: cases(), water, trial: { ...biologist().trial, waterUsed: 1 }, actions: [buy] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(water.summary)).toBeTruthy();
    expect(screen.getByRole("region", { name: "原样本、同一原苗与实际资源" }).textContent).toContain("本阶段实际用水1份");
    await userEvent.click(screen.getByRole("button", { name: /^补充原植床的水/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_WATER" });
    expect(screen.getByText(water.summary)).toBeTruthy();
    rerender(<BiologistPanel biologist={{ ...value, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /复核|购买|补充/ })).toBeNull();
  });

  it("retains an ordinary route when actual ability costs are unavailable", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "paired-seedling", method: "ABILITY" }, "准备有限对照实践", false, "执行需1份原水与3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "paired-seedling", method: "ORDINARY" }, "准备普通对照记录", true, "执行需1份原水 · 0灵性");
    const { onCommand } = panel(biologist({ promoted: true, cases: cases(), actions: [ability, ordinary] }));
    const disabled = screen.getByRole("button", { name: /^准备有限对照实践/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`biologist-reason-${ability.id}`);
    expect(screen.getByText(ability.reason)).toBeTruthy();
    fireEvent.click(disabled); await userEvent.click(screen.getByRole("button", { name: /^准备普通对照记录/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it.each(["sample-record", "paired-seedling", "safe-return"])("pins actual %s contact to zero-cost CLOSE without inferring local success", async (caseId) => {
    const { onCommand, rerender } = panel(biologist({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "sample-record" ? "safe-return" : "sample-record";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId);
    rerender(<BiologistPanel biologist={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧实践的无效结束", false), ...value.actions,
      action({ type: "VERIFY", caseId: "paired-seedling" }, "不能提前复核"),
      action({ type: "REPORT", caseId }, "不能提前报告"), action({ type: "WITHDRAW", caseId }, "不能用撤回代替结束"),
      action({ type: "BUY_WATER" }, "不能提前补水"), action({ type: "REFLECT" }, "不能提前反思"),
      action({ type: "ENCOUNTER_FIGHT" }, "不能提前冲突"),
    ] }} resources={{ ...resources, actionsRemaining: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束本次实践，回到生活/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose);
    await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
    expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    expect(screen.getByText("原苗位置：同一温室原台，仍是伊芙的原苗")).toBeTruthy();
  });

  it("lets waiting remain separate from contact and verifies only through the actual saved command", async () => {
    const verify = { ...action({ type: "VERIFY", caseId: "paired-seedling" }, "亲自复核同一原苗", false, "1行动 · 0灵性"), reason: "本次第40周开始，至少第41周才可实际复核。" };
    const value = biologist({ promoted: true, cases: cases(), actions: [verify],
      trial: { careWeek: 40, verifiedWeek: null, waterUsed: 1, location: "BENCH", status: "WAITING" } });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "paired-seedling");
    expect(screen.getByRole("status").textContent).toContain("最早第41周");
    expect(screen.getByRole("status").textContent).toContain("现在可回到生活");
    expect(screen.getByRole("status").textContent).toContain("过周不会自动验证");
    const button = screen.getByRole("button", { name: /^亲自复核同一原苗/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    const eligible = { ...value, actions: [{ ...verify, enabled: true, reason: null }] };
    rerender(<BiologistPanel biologist={eligible} resources={resources} busy={false} onCommand={onCommand} />);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^亲自复核同一原苗/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "VERIFY", caseId: "paired-seedling" });
    expect(screen.getByText("同一原苗：同一原苗已有试验记录，尚未实际复核")).toBeTruthy();
    rerender(<BiologistPanel biologist={{ ...eligible, actions: [], trial: { ...value.trial, verifiedWeek: 41, status: "VERIFIED" }, cases: cases().map((entry) => entry.id === "paired-seedling" ? { ...entry, result: "已亲自记录原苗有限变化；不能认定可食用，没有新增粮食。" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原苗：已实际复核同一原苗，有限结论保留")).toBeTruthy();
    expect(screen.getByRole("region", { name: "生物学家实际结果" }).textContent).toContain("不能认定可食用");
    expect(screen.queryByRole("status")).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps the original seedling on the bench until actual safe return is committed", async () => {
    const perform = action({ type: "PERFORM", caseId: "safe-return" }, "确认警告并实际交回原苗");
    const value = biologist({ promoted: true, actions: [perform], cases: cases().map((entry) => entry.id === "safe-return" ? { ...entry, status: "PREPARED", preparation: "已核对有限结论，将告知未知并当面交回。" } : entry),
      trial: { careWeek: 40, verifiedWeek: 41, waterUsed: 1, location: "BENCH", status: "VERIFIED" } });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^确认警告并实际交回原苗/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.getByText("原苗位置：同一温室原台，仍是伊芙的原苗")).toBeTruthy();
    expect(screen.getByText("有限结论与未知警告：尚未实际核对并记录")).toBeTruthy();
    rerender(<BiologistPanel biologist={{ ...value, insideCase: true, actions: [action({ type: "CLOSE", caseId: "safe-return" }, "实际结束归还实践", true, zeroClose)],
      practice: { sampleRecorded: true, warningsRecorded: true }, trial: { ...value.trial, location: "OWNER", status: "RETURNED" },
    }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原苗位置：同一温室内，已当面交回原主伊芙")).toBeTruthy();
    expect(screen.getByText("有限结论与未知警告：已实际核对并记录")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束归还实践/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CLOSE", caseId: "safe-return" });
    expect(screen.getByText("原苗位置：同一温室内，已当面交回原主伊芙")).toBeTruthy();
  });

  it("does not manufacture CLOSE, VERIFY, water or future facts from stale prose", () => {
    const value = { ...opened(), actions: [], privatePlan: "PRIVATE_NEVER_RENDER", future: "FUTURE_NEVER_RENDER",
      cases: cases().map((entry) => ({ ...entry, result: "旧文字写已复核归还，本次仍需依实际状态。" })) };
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "生物学家成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.getByText("原苗位置：同一温室原台，仍是伊芙的原苗")).toBeTruthy();
    for (const text of [value.privatePlan, value.future]) expect(document.body.textContent).not.toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks every mutation through pending saves or errors while retaining original facts", () => {
    const value = biologist({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "sample-record" }, "观察原封样本"), action({ type: "BUY_WATER" }, "补充原库存")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<BiologistPanel biologist={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.water.summary)).toBeTruthy();
    }
    rerender(<BiologistPanel biologist={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows nine actual mastery records with finite research and inherited combat boundaries", async () => {
    const ids = ["mother.s9.cultivation-knowledge", "mother.s9.season-observation", "mother.s9.careful-practice", "mother.s8.limited-healing", "mother.s8.condition-observation", "mother.s7.harvest-care", "mother.s7.life-support", "mother.s6.specimen-study", "mother.s6.controlled-trial"];
    const abilities = ids.map((id, index) => ({ id, label: `原第${index + 1}项能力`, mastery: index + 10, description: `第${index + 1}项已保存掌握。` }));
    const actions = [action({ type: "ENCOUNTER_TALK" }, "澄清温室外院争议"), action({ type: "ENCOUNTER_FIGHT" }, "承担外院实际冲突")];
    const value = biologist({ promoted: true, acting: 100, abilities, actions }), before = structuredClone(value);
    const { onCommand } = panel(value);
    expect(screen.getByRole("heading", { name: "能力与消化 · 9 项训练记录" })).toBeTruthy();
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByText("查看样本研究、有限试验与继承能力边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    expect(within(boundary).getByText("本序列新增有限样本研究与有限对照实践两项独立掌握，继承七项原能力，共九项记录；旧能力与原掌握保留。本阶段可通过三项具体实践继续成长与和平消化，具体数值按当前公开说明执行。")).toBeTruthy();
    expect(within(boundary).getByText("弗兰克的个人高阶神战事故不复制为通用能力；序列5的潜地能力未下放，本阶段也不开放动物变形。战斗只使用普通身体、可见观察与继承有限自护，不新增植物攻击。")).toBeTruthy();
    expect(boundary.textContent).not.toContain("为适配。");
    expect(value).toEqual(before);
    for (const text of ["继承七项原能力", "原封样本", "不拆封", "下一真实周", "周结不会自动验证", "原主伊芙", "不构成食用安全保证", "序列5的潜地能力未下放", "不新增植物攻击", "结束实践0行动、0精神、0灵性", "新增有限样本研究与有限对照实践两项独立掌握", "共九项记录；旧能力与原掌握保留"])
      expect(boundary.textContent).toContain(text);
    const encounter = screen.getByRole("region", { name: "生物学家有限冲突" });
    for (const text of ["普通身体动作", "当前可见状况", "继承的有限自护", "不变成植物攻击", "实际退出"]) expect(encounter.textContent).toContain(text);
    for (const entry of actions) await userEvent.click(within(encounter).getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("preserves old harvest, water, delivery, plans, failure and original bottles as read-only history", () => {
    const harvestpriest: HarvestpriestProjection = {
      title: "丰收祭司", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原丰收祭司独立供给。", story: "原丰收祭司故事。", environment: "原植床照护已实际结束。",
      plot: "原植床实用2份水、剩余0份；收获3份，已交2份，留1份；下一季计划不新增粮食。",
      cases: [{ id: "shared-yield", title: "原有限收成分配", story: "原收成与已交份数保留。", status: "RESOLVED", observations: ["原水、原收成与实际交付均已核对。"], preparation: "普通核对有限份数。", result: "曾照护失败耗水；后收获原3份，交付2份未返还。", contactOpen: "已实际结束原实践", closes: 2 }],
      actions: [{ id: "old-perform", label: "不可在旧历史中重做分配", cost: "原成本", enabled: true, reason: null, command: { type: "PERFORM", caseId: "shared-yield" } }],
      bottles: [{ id: "harvestpriest-original-1", title: "丰收祭司旧原瓶", source: "独立丰收祭司原批成品", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "harvestpriest-original-1", confirmed: true } }],
      abilities: [{ id: "mother.s7.life-support", label: "原生命支持", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<BiologistHarvestpriestHistory harvestpriest={harvestpriest} />);
    const region = screen.getByRole("region", { name: "丰收祭司时期的经历" }); const history = within(region);
    for (const text of [harvestpriest.story!, harvestpriest.supplies, harvestpriest.plot, "原案卷ID：shared-yield", "原瓶ID：harvestpriest-original-1", "当时实际结束次数：2", "当时的实际结果与报告：曾照护失败耗水；后收获原3份，交付2份未返还。", "来源：独立丰收祭司原批成品", "已耗用 · 原失败保留", "原生命支持 · 掌握 67：保留原能力实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可在旧历史中重做分配")).toBeNull();
    for (const details of region.querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
