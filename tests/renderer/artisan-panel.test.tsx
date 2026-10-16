/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtisanAction, ArtisanCommand, ArtisanProjection } from "../../src/domain/artisan/types";
import type { AppraiserProjection } from "../../src/domain/appraiser/types";
import { ArtisanPanel, ArtisanAppraiserHistory } from "../../src/renderer/ArtisanPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与补给继续恢复。";
function action(command: ArtisanCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): ArtisanAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取工匠成品用药指导", true, "360便士 · 1行动");
function artisan(patch: Partial<ArtisanProjection> = {}): ArtisanProjection {
  return {
    title: "工匠晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "鉴定师扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    workshop: { summary: "原工房与原工具仍在。", materials: "铜壳0只，教学灵性材料0份；本批材料包剩余3套。", lamp: null, remainingUses: 0, delivered: false }, ...patch,
  };
}
function cases(): ArtisanProjection["cases"] {
  return [
    { id: "reading-diagram", title: "原图纸上的刻度", story: "核对已知图纸与原工房工具，先读懂微光灯片的有限规格。" },
    { id: "limited-fabrication", title: "铜壳里的有限微光", story: "用付费铜壳与教学灵性材料，在原工房实际制造一枚G微光灯片。" },
    { id: "client-handover", title: "刻度检验与本人交付", story: "检验同一原件的刻度，消耗一次照明后把灯片交给委托人本人。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function bottled(): ArtisanProjection {
  const originals = [
    { id: "artisan-potion-1", title: "第一瓶工匠魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "artisan-potion-2", title: "第二瓶工匠魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "artisan-potion-3", title: "第三瓶工匠魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return artisan({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): ArtisanProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "制造失败：实际耗用铜壳1只、教学灵性材料1份与4灵性；没有生成灯片原件。";
function opened(): ArtisanProjection {
  return artisan({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "limited-fabrication" ? {
      ...entry, status: "EXAMINED", observations: ["原工房工具已核对，付费原料用于本次制作。", failure],
      result: failure, contactOpen: "本次制造现场尚未实际结束",
    } : entry),
    workshop: { summary: "已记录一次制造失败。", materials: "铜壳0只，教学灵性材料0份；本批剩余2套可购买。", lamp: null, remainingUses: 0, delivered: false },
    actions: [action({ type: "CLOSE", caseId: "limited-fabrication" }, "实际结束制造现场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: ArtisanProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ArtisanPanel artisan={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Artisan original materials, bounded manufacture and independent potion confirmation", () => {
  it("shows the public S7 maturity gate and sourced finished supply without inventing an unknown formula", () => {
    const reason = "鉴定师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = artisan({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "工匠成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取工匠成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact public guidance, per-bottle labour, payment and resupply commands with public costs", async () => {
    const commands: ArtisanCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "artisan-potion-3" },
      { type: "BUY_POTION", bottleId: "artisan-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(artisan({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels an original-bottle confirmation at zero AP and returns keyboard focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶工匠魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶工匠魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶工匠魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶工匠魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶工匠魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows exact source, risk and current resources before independently confirming only the selected bottle once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶工匠魔药」" }));
    expect(screen.getByText("artisan-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "工匠服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶工匠魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "artisan-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted original through save failure and leaves envelope retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶工匠魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶工匠魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<ArtisanPanel artisan={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶工匠魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶工匠魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("artisan-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<ArtisanPanel artisan={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original as history and independently offers the remaining bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶工匠魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶工匠魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<ArtisanPanel artisan={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶工匠魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶工匠魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("artisan-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only when a committed promotion arrives and preserves the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶工匠魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶工匠魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升工匠" } : bottle) };
    rerender(<ArtisanPanel artisan={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶工匠魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "工匠能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升工匠")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects distinct stories and forwards exact public case commands without optimistic preparation or products", async () => {
    const commands: ArtisanCommand[] = [{ type: "OBSERVE", caseId: "reading-diagram" },
      { type: "PREPARE", caseId: "reading-diagram", method: "ORDINARY" },
      { type: "PREPARE", caseId: "reading-diagram", method: "ABILITY" },
      { type: "PERFORM", caseId: "reading-diagram" }, { type: "WITHDRAW", caseId: "reading-diagram" }, { type: "REPORT", caseId: "reading-diagram" }];
    const labels = ["核对已知图纸", "准备普通读图", "准备工匠读图", "实际核对刻度", "撤回待执行工序", "提交读图记录"];
    const { onCommand } = panel(artisan({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "原料、原件与实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "reading-diagram");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "工序与准备" }).textContent).toContain("当前没有待执行的工序");
    expect(screen.getByRole("region", { name: "工房原料与灯片原件" }).textContent).toContain("尚无制造成功的灯片原件");
  });

  it("uses only the published manufacturing method and keeps material requirements visible", async () => {
    const prepare = action({ type: "PREPARE", caseId: "limited-fabrication", method: "ABILITY" }, "准备有限非凡制造", false, "1行动 · 准备不耗料");
    prepare.reason = "尚缺铜壳1只和教学灵性材料1份，请按公开材料包补购。";
    const perform = action({ type: "PERFORM", caseId: "limited-fabrication" }, "实际制造微光灯片", false, "1行动 · 4灵性 · 铜壳1只 · 教学灵性材料1份");
    const buy = action({ type: "BUY_KIT" }, "购买原工房材料包", true, "100便士 · 0行动 · 铜壳1只与教学灵性材料1份");
    const { onCommand } = panel(artisan({ promoted: true, cases: cases(), actions: [prepare, perform, buy] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "limited-fabrication");
    const button = screen.getByRole("button", { name: /^准备有限非凡制造/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(prepare.reason)).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByText(prepare.reason).id);
    expect(screen.getByRole("button", { name: /^实际制造微光灯片/ }).textContent).toContain("4灵性 · 铜壳1只 · 教学灵性材料1份");
    fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /普通制造|免费制造|凭空造物/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^购买原工房材料包/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_KIT" });
    expect(screen.getByText("铜壳0只，教学灵性材料0份；本批材料包剩余3套。")).toBeTruthy();
  });

  it("retains failed material consumption through CLOSE, paid replenishment and committed retry preparation", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const workshop = () => within(screen.getByRole("region", { name: "工房原料与灯片原件" }));
    expect(screen.getByRole("region", { name: "原料、原件与实际结果" }).textContent).toContain(failure);
    expect(workshop().getByText(value.workshop.materials)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束制造现场/ }));
    expect(workshop().getByText(value.workshop.materials)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [action({ type: "BUY_KIT" }, "付费补购原料", true, "100便士 · 0行动")],
      cases: value.cases.map((entry) => entry.id === "limited-fabrication" ? { ...entry, contactOpen: "已实际结束", closes: 1 } : entry) };
    rerender(<ArtisanPanel artisan={closed} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^付费补购原料/ }));
    expect(workshop().getByText(value.workshop.materials)).toBeTruthy();
    const replenished = { ...closed, workshop: { ...closed.workshop, materials: "铜壳1只，教学灵性材料1份；本批剩余1套。" },
      actions: [action({ type: "PREPARE", caseId: "limited-fabrication", method: "ABILITY" }, "准备重新制造")],
      cases: closed.cases.map((entry) => entry.id === "limited-fabrication" ? { ...entry, preparation: "使用补购的原料重做，不返还上次材料。" } : entry) };
    rerender(<ArtisanPanel artisan={replenished} resources={resources} busy={false} onCommand={onCommand} />);
    expect(workshop().getByText(replenished.workshop.materials)).toBeTruthy();
    expect(screen.getByRole("region", { name: "公开观察与原件记录" }).textContent).toContain(failure);
    expect(screen.getByText("使用补购的原料重做，不返还上次材料。")).toBeTruthy();
    expect(workshop().queryByText("原件剩余照明")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^准备重新制造/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "CLOSE", caseId: "limited-fabrication" }, { type: "BUY_KIT" }, { type: "PREPARE", caseId: "limited-fabrication", method: "ABILITY" },
    ]);
  });

  it("shows exhausted paid supply and its next-week reason rather than inventing replacement stock", () => {
    const buy = action({ type: "BUY_KIT" }, "购买原工房材料包", false, "100便士 · 0行动");
    buy.reason = "本批3套材料包已经耗尽，须等实际下一周补给。";
    const { onCommand } = panel(artisan({ promoted: true, actions: [buy],
      workshop: { summary: "原工房工具未变。", materials: "铜壳0只，教学灵性材料0份；材料包剩余0套。", lamp: null, remainingUses: 0, delivered: false } }));
    const button = screen.getByRole("button", { name: /^购买原工房材料包/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(buy.reason)).toBeTruthy();
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /刷新库存|补满|无限/ })).toBeNull();
  });

  it("keeps the same successful original and displays real test consumption and delivery only after committed updates", async () => {
    const perform = action({ type: "PERFORM", caseId: "client-handover" }, "实际检验原灯片刻度", true, "1行动 · 照明1次 · 精神1");
    const deliver = action({ type: "REPORT", caseId: "client-handover" }, "将同一原件交给委托人本人", true, "1行动 · 转交ART6-LAMP-1");
    const value = artisan({ promoted: true, cases: cases(), actions: [perform],
      workshop: { summary: "原料已用于成功制造。", materials: "铜壳0只，教学灵性材料0份。", lamp: "ART6-LAMP-1 · G微光灯片原件 · 玩家保管", remainingUses: 3, delivered: false } });
    const { onCommand, rerender } = panel(value);
    const workshop = () => within(screen.getByRole("region", { name: "工房原料与灯片原件" }));
    expect(workshop().getByText(value.workshop.lamp!)).toBeTruthy();
    expect(workshop().getByText("3 次")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际检验原灯片刻度/ }));
    expect(workshop().getByText("3 次")).toBeTruthy();
    expect(workshop().getByText("原件尚未交给委托人")).toBeTruthy();
    const tested = { ...value, actions: [deliver], workshop: { ...value.workshop, remainingUses: 2 },
      cases: value.cases.map((entry) => entry.id === "client-handover" ? { ...entry, result: "同一原件已完成刻度检验，实际消耗1次照明和1精神。" } : entry) };
    rerender(<ArtisanPanel artisan={tested} resources={{ ...resources, mind: 87 }} busy={false} onCommand={onCommand} />);
    expect(workshop().getByText("2 次")).toBeTruthy();
    expect(screen.getByText("同一原件已完成刻度检验，实际消耗1次照明和1精神。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^将同一原件交给委托人本人/ }));
    expect(workshop().getByText("原件尚未交给委托人")).toBeTruthy();
    const delivered = { ...tested, actions: [], workshop: { ...tested.workshop, lamp: "ART6-LAMP-1 · G微光灯片原件 · CLIENT本人保管", delivered: true } };
    rerender(<ArtisanPanel artisan={delivered} resources={{ ...resources, mind: 87 }} busy={false} onCommand={onCommand} />);
    expect(workshop().getByText(delivered.workshop.lamp)).toBeTruthy();
    expect(workshop().getByText("原件已交给委托人本人")).toBeTruthy();
    expect(workshop().getByText("2 次")).toBeTruthy();
    expect(workshop().queryByText(value.workshop.lamp!)).toBeNull();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([perform.command, deliver.command]);
  });

  it("selects the true open scene and enables public CLOSE at zero AP, mind and spirituality while retaining disabled reasons", async () => {
    const { onCommand, rerender } = panel(artisan({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "client-handover");
    const value = opened();
    const held = [action({ type: "REPORT", caseId: "limited-fabrication" }, "暂不可提交制造报告", false),
      action({ type: "WITHDRAW", caseId: "limited-fabrication" }, "撤回不能替代实际结束", false),
      action({ type: "BUY_KIT" }, "结束现场后补购", false), action({ type: "REFLECT" }, "结束现场后复盘", false),
      action({ type: "ENCOUNTER_TALK" }, "结束现场后赴后门", false)];
    held.forEach((entry, index) => { entry.reason = `本次现场尚未实际结束：公开禁用原因${index + 1}`; });
    rerender(<ArtisanPanel artisan={{ ...value, actions: [action({ type: "CLOSE", caseId: "reading-diagram" }, "旧记录不可结束", false), ...value.actions, ...held] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("limited-fabrication"); expect(selector.disabled).toBe(true);
    const close = screen.getByRole("button", { name: /^实际结束制造现场/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    for (const entry of held) {
      const button = screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); expect(screen.getByText(entry.reason!)).toBeTruthy(); fireEvent.click(button);
    }
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "limited-fabrication" });
    expect(screen.getByRole("region", { name: "原料、原件与实际结果" }).textContent).toContain(failure);
    expect(screen.getByText(/本次现场：本次制造现场尚未实际结束/)).toBeTruthy();
  });

  it("never manufactures CLOSE from historical prose or treats past failures as an active scene", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "工匠成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("reading-diagram");
    rerender(<ArtisanPanel artisan={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "limited-fabrication");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "公开观察与原件记录" }).textContent).toContain(failure);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("disables interactions while busy, blocked or waiting on a save error without changing workshop stock", () => {
    const value = artisan({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "reading-diagram" }, "核对原图纸"), action({ type: "BUY_KIT" }, "补购原料")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }, { busy: false, error: { message: "版本不一致", retryable: false } }]) {
      rerender(<ArtisanPanel artisan={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
      expect(screen.getByText(value.workshop.materials)).toBeTruthy();
    }
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows public mastery and bounded G illumination without granting combat or secret-revealing abilities", () => {
    const abilities = [{ id: "paragon.s6.mechanical-craft", label: "机械工艺", mastery: 23, description: "在已有图纸与工具条件下实践。" },
      { id: "paragon.s6.spiritual-craft", label: "有限非凡制造", mastery: 41, description: "制造需要实际材料，失败消耗仍保留。" }];
    panel(artisan({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("机械工艺 · 掌握 23")).toBeTruthy(); expect(screen.getByText("有限非凡制造 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "工匠能力边界" });
    for (const text of ["三项主实践可和平完成", "制造只用工匠能力", "普通方法不能凭空造出非凡物", "3次有限照明", "1次照明与1精神", "剩余2次", "没有光束攻击、驱邪或照见秘密", "有限3套"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /光束攻击|驱邪|照见秘密|制作封印物/ })).toBeNull();
  });

  it("keeps optional Devin talk or ordinary short-club combat separate from the three workshop cases", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与后门德文交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴后门承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原后门仍有通路，交付的灯片由委托人保管。";
    const { onCommand } = panel(artisan({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限后门冲突" }));
    expect(encounter.getByText(/微光灯片没有战斗能力/)).toBeTruthy();
    await userEvent.click(encounter.getByRole("button", { name: /^与后门德文交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴后门承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "原料、原件与实际结果" })).toBeNull();
    expect(screen.getByText(environment)).toBeTruthy();
  });

  it("preserves S7 inspected originals, findings, risks, bottle IDs and abilities as read-only history", () => {
    const appraiser: AppraiserProjection = {
      title: "鉴定师", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原鉴定师库存与耗用记录保留。", story: "旧原物的有限鉴定已完成。", environment: "原鉴定柜与原件去向保留。",
      items: [{ id: "warm-lamp", title: "原暖灯", story: "原试用失败与实际耗用记录保留。", status: "已完成，原失败保留",
        observations: ["原暖灯仅作有限照明，未交付任意攻击能力。"], finding: "只能确认已试验的照明范围。", risk: "当时的精神消耗和照明次数仍保留。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "appraiser-old", title: "鉴定师旧原瓶", source: "鉴定师原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "appraiser-old", confirmed: true } }],
      abilities: [{ id: "paragon.s7.appraisal", label: "原有限鉴定", mastery: 67, description: "保留当时可知的原件功能与未知边界。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<ArtisanAppraiserHistory appraiser={appraiser} />);
    const history = within(screen.getByRole("region", { name: "鉴定师时期的经历" }));
    expect(history.getByText("原试用失败与实际耗用记录保留。")).toBeTruthy();
    expect(history.getByText("原暖灯仅作有限照明，未交付任意攻击能力。")).toBeTruthy();
    expect(history.getByText("当时的有限鉴定：只能确认已试验的照明范围。")).toBeTruthy();
    expect(history.getByText("原件风险与代价：当时的精神消耗和照明次数仍保留。")).toBeTruthy();
    expect(history.getByText("原件ID：warm-lamp")).toBeTruthy(); expect(history.getByText("原瓶ID：appraiser-old")).toBeTruthy();
    expect(history.getByText("来源：鉴定师原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原有限鉴定 · 掌握 67：保留当时可知的原件功能与未知边界。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});

