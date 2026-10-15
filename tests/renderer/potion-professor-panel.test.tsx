/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PotionProfessorAction, PotionProfessorAssistanceKind, PotionProfessorCommand, PotionProfessorProjection } from "../../src/domain/potion-professor/types";
import type { VampireProjection } from "../../src/domain/vampire/types";
import { PotionProfessorPanel, PotionProfessorVampireHistory } from "../../src/renderer/PotionProfessorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与補给继续恢复。";
const kinds: PotionProfessorAssistanceKind[] = ["QUIET_STEP", "ODOR_VEIL", "BODY_VEIL", "CLOTH_VEIL"];
const kindLabels = ["静步辅助药", "去味辅助药", "身体透明辅助药", "衣物透明辅助药"];
const noEffects = { quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false };
function action(command: PotionProfessorCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PotionProfessorAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取魔药教授成品用药指导", true, "360便士 · 1行动");
function professor(patch: Partial<PotionProfessorProjection> = {}): PotionProfessorProjection {
  return {
    title: "魔药教授晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "吸血鬼扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    laboratory: { summary: "G封闭教学卡已登记。", materials: "G教学灵性材料0份；本批材料包剩余3包。", potions: [], effects: { ...noEffects } }, ...patch,
  };
}
function cases(): PotionProfessorProjection["cases"] {
  return [
    { id: "quiet-passage", title: "一段有限的静步通道", story: "先核对通道，再实际使用静步原瓶走过原路。" },
    { id: "separate-signals", title: "身体、衣物与气味分别验证", story: "在已核对的场地依次使用三瓶，分别验证身体、衣物和气味。" },
    { id: "willing-student", title: "愿意学习的成年人", story: "自愿参加的成年学员正在等待有限教学，随时可以结束本次练习。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function bottled(): PotionProfessorProjection {
  const originals = [
    { id: "professor-potion-1", title: "第一瓶魔药教授魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "professor-potion-2", title: "第二瓶魔药教授魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "professor-potion-3", title: "第三瓶魔药教授魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return professor({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): PotionProfessorProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function assistance(used = false): PotionProfessorProjection["laboratory"]["potions"] {
  return kinds.map((kind, index) => ({ id: `PP6-${index + 1}`, kind, title: `${kindLabels[index]}原瓶`, source: `第${index + 1}次G封闭教学配制`,
    status: used ? "已耗用，原瓶记录保留" : "实际持有，尚未使用", brewedWeek: 36, usedWeek: used ? 37 : null }));
}
const threeResults = ["耗用PP6-3：身体透明，衣物仍可见，气味仍存在。", "耗用PP6-4：另行处理衣物透明。", "耗用PP6-2：另行处理去味，三瓶各自保留耗用记录。"];
function opened(): PotionProfessorProjection {
  return professor({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "separate-signals" ? { ...entry, status: "EXAMINED", observations: threeResults,
      result: "本次依次耗用身体、衣物、去味三瓶，三种短效尚未实际结束。", contactOpen: "本次验证现场尚未实际结束" } : entry),
    laboratory: { summary: "三种短效仍在本次已付事项内。", materials: "G教学灵性材料0份；本批材料包剩余2包。",
      potions: assistance(true), effects: { ...noEffects, bodyVeil: true, clothVeil: true, odorVeil: true } },
    actions: [action({ type: "CLOSE", caseId: "separate-signals" }, "确认短效实际结束并退离", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: PotionProfessorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PotionProfessorPanel potionProfessor={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Potion professor separate assistance originals and independent promotion confirmation", () => {
  it("shows the public S7 maturity gate, actual costs and unknown-formula boundary", () => {
    const reason = "吸血鬼扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = professor({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    const summary = screen.getByRole("region", { name: "魔药教授成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务后付320便士", "意志24四档", "抽象封闭教学卡", "不提供现实制作步骤"])
      expect(summary.textContent).toContain(text);
    expect(summary.textContent).toContain("完整晋升魔药配方与剂量尚未掌握");
    for (const marker of ["G抽象", "G指导", "未核实"]) expect(summary.textContent).not.toContain(marker);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取魔药教授成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|跳过成熟/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact public guidance, per-bottle labour, payment and resupply commands", async () => {
    const commands: PotionProfessorCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "professor-potion-3" },
      { type: "BUY_POTION", bottleId: "professor-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(professor({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels an original-bottle confirmation at zero AP and returns keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶魔药教授魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶魔药教授魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶魔药教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶魔药教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶魔药教授魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows source, risk and current resources before independently confirming the selected bottle once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶魔药教授魔药」" }));
    expect(screen.getByText("professor-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "魔药教授服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶魔药教授魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "professor-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted original through save failure and leaves retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶魔药教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔药教授魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<PotionProfessorPanel potionProfessor={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶魔药教授魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔药教授魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("professor-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<PotionProfessorPanel potionProfessor={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("keeps a committed failed original as history and independently offers the remaining bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶魔药教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔药教授魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<PotionProfessorPanel potionProfessor={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶魔药教授魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶魔药教授魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("professor-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only on committed promotion and keeps the consumed promotion original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶魔药教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶魔药教授魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升魔药教授" } : bottle) };
    rerender(<PotionProfessorPanel potionProfessor={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶魔药教授魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "魔药教授能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升魔药教授")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects distinct stories and forwards case commands without optimistic preparation or effects", async () => {
    const commands: PotionProfessorCommand[] = [{ type: "OBSERVE", caseId: "quiet-passage" },
      { type: "PREPARE", caseId: "quiet-passage", method: "ABILITY" }, { type: "PERFORM", caseId: "quiet-passage" },
      { type: "WITHDRAW", caseId: "quiet-passage" }, { type: "REPORT", caseId: "quiet-passage" }];
    const labels = ["核对原通道", "准备静步原瓶验证", "实际使用静步原瓶", "撤回待执行验证", "提交静步记录"];
    const { onCommand } = panel(professor({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "辅助药与实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "quiet-passage");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "验证与准备" }).textContent).toContain("当前没有待执行的验证");
    expect(screen.getByRole("region", { name: "已保存的辅助药短效" }).textContent).toContain("无持续药效");
  });

  it("uses a compact selector to dispatch every exact assistance kind without opening promotion confirmation", async () => {
    const actions = kinds.map((kind, index) => action({ type: "BREW_ASSISTANCE", kind }, `配制${kindLabels[index]}`, true, "1行动 · 2灵性 · G教学灵性材料1份"));
    const value = professor({ promoted: true, cases: cases(), actions }); const { onCommand } = panel(value);
    const group = within(screen.getByRole("group", { name: "辅助药配制与材料行动" }));
    expect(group.getAllByRole("button")).toHaveLength(1);
    for (const entry of actions) {
      await userEvent.selectOptions(group.getByRole("combobox", { name: "选择要配制的辅助药" }), entry.id);
      await userEvent.click(group.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(screen.queryByRole("region", { name: "这瓶魔药教授魔药的服用确认" })).toBeNull();
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(kinds.map((kind) => ({ type: "BREW_ASSISTANCE", kind })));
    expect(screen.getByText(value.laboratory.materials)).toBeTruthy();
    expect(screen.getByText("尚无已配制成功的辅助药原瓶。准备与失败不会生成成品。")).toBeTruthy();
  });

  it("displays each assistance original, source, spent status and week without adding consume-promotion actions", () => {
    const potions = assistance().map((potion, index) => index === 0 ? { ...potion, usedWeek: 37, status: "已耗用PP6-1，原记录保留" } : potion);
    const base = professor(); panel(professor({ promoted: true, actions: [], laboratory: { ...base.laboratory, potions } }));
    const laboratory = within(screen.getByRole("region", { name: "实验室材料与辅助药原瓶" }));
    for (const potion of potions) {
      expect(laboratory.getByText(potion.title)).toBeTruthy(); expect(laboratory.getByText(`来源：${potion.source}`)).toBeTruthy();
      expect(laboratory.getByText(new RegExp(`辅助药原瓶ID：${potion.id}`))).toBeTruthy();
    }
    expect(laboratory.getByText("已耗用PP6-1，原记录保留")).toBeTruthy();
    expect(laboratory.getByText("配制周：36 · 耗用周：37")).toBeTruthy();
    expect(laboratory.queryByRole("button")).toBeNull();
  });

  it("explains the three separate bottles and shows body transparency without silently applying clothes or odor effects", () => {
    const value = opened(); panel({ ...value, laboratory: { ...value.laboratory, effects: { ...noEffects, bodyVeil: true } } });
    const boundary = screen.getByRole("region", { name: "魔药教授能力边界" });
    for (const text of ["一次明确行动内依次耗用身体透明、衣物透明、去味三瓶", "身体透明不会自动让衣物透明", "也不会消除气味"])
      expect(boundary.textContent).toContain(text);
    const records = within(screen.getByRole("region", { name: "公开观察与药剂记录" }));
    for (const result of threeResults) expect(records.getByText(result)).toBeTruthy();
    const effects = within(screen.getByRole("region", { name: "已保存的辅助药短效" }));
    expect(effects.getByText("本次身体透明短效尚未结束")).toBeTruthy();
    expect(effects.getByText("无持续衣物透明药效")).toBeTruthy(); expect(effects.getByText("无持续去味药效")).toBeTruthy();
  });

  it("pins the actual open case and permits its public CLOSE at zero AP, mind and spirituality", async () => {
    const initial = professor({ promoted: true, cases: cases(), actions: [] }); const { onCommand, rerender } = panel(initial);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "willing-student");
    const value = opened();
    rerender(<PotionProfessorPanel potionProfessor={value} resources={{ ...resources, actionsRemaining: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("separate-signals"); expect(selector.disabled).toBe(true);
    const close = screen.getByRole("button", { name: /^确认短效实际结束并退离/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "separate-signals" });
    expect(screen.getByText("本次身体透明短效尚未结束")).toBeTruthy();
    const next = screen.getByRole("region", { name: "魔药教授成长下一步" });
    for (const text of ["本次已付事项内", "结束全部辅助药效", "不能跳过退出直接继续生活", "不退款", "不治疗"]) expect(next.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /继续生活|跳过退出/ })).toBeNull();
  });

  it("clears all effects only on committed CLOSE while preserving used originals, materials and failed observations", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^确认短效实际结束并退离/ }));
    const closed = { ...value, insideCase: false, actions: [], laboratory: { ...value.laboratory, effects: { ...noEffects } },
      cases: value.cases.map((entry) => entry.id === "separate-signals" ? { ...entry, contactOpen: "G短效已结束并已退离", closes: 1 } : entry) };
    rerender(<PotionProfessorPanel potionProfessor={closed} resources={resources} busy={false} onCommand={onCommand} />);
    const effects = screen.getByRole("region", { name: "已保存的辅助药短效" });
    expect(effects.textContent).not.toContain("尚未结束");
    expect(screen.getByText(value.laboratory.materials)).toBeTruthy();
    expect(screen.getAllByText("已耗用，原瓶记录保留")).toHaveLength(4);
    expect(screen.getByRole("region", { name: "公开观察与药剂记录" }).textContent).toContain(threeResults[0]);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("retains failed brewing costs and exhausted paid supply with the next-week blocker", () => {
    const failure = "本次配制失败：实际耗用1份G材料与2灵性，没有生成辅助药原瓶。";
    const buy = action({ type: "BUY_KIT" }, "购买四份G材料包", false, "100便士 · 0行动 · 4份G教学灵性材料");
    buy.reason = "本批3包材料已经耗尽，须等实际下一周补给。";
    const base = professor(); const { onCommand } = panel(professor({ promoted: true, story: failure, actions: [buy],
      laboratory: { ...base.laboratory, summary: "已记录一次实际配制失败。", materials: "G教学灵性材料0份；材料包剩余0包。" } }));
    const button = screen.getByRole("button", { name: /^购买四份G材料包/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.getAttribute("aria-describedby")).toBe(screen.getByText(buy.reason).id);
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText("G教学灵性材料0份；材料包剩余0包。")).toBeTruthy();
    expect(screen.getByText("尚无已配制成功的辅助药原瓶。准备与失败不会生成成品。")).toBeTruthy();
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /刷新库存|补满|无限/ })).toBeNull();
  });

  it("keeps required original bottles visible and offers only the published ability verification method", async () => {
    const prepare = action({ type: "PREPARE", caseId: "separate-signals", method: "ABILITY" }, "准备三瓶分开验证", false, "1行动 · 准备不耗药");
    prepare.reason = "尚缺身体透明、衣物透明与去味三瓶独立成品。";
    const buy = action({ type: "BUY_KIT" }, "购买四份G材料包", true, "100便士 · 0行动 · 4份材料");
    const { onCommand } = panel(professor({ promoted: true, cases: cases(), actions: [prepare, buy] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "separate-signals");
    const button = screen.getByRole("button", { name: /^准备三瓶分开验证/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(prepare.reason)).toBeTruthy(); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /普通透明|无药隐身|凭空配药/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^购买四份G材料包/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_KIT" });
    expect(screen.getByText("G教学灵性材料0份；本批材料包剩余3包。")).toBeTruthy();
  });

  it("allows the public ordinary teaching option only for the willing adult lesson", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "willing-student", method: "ORDINARY" }, "准备普通对照教学", true, "1行动 · 尊重成人学员意愿");
    const { onCommand } = panel(professor({ promoted: true, cases: cases(), actions: [ordinary] }));
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("willing-student");
    expect(screen.getByText(cases()[2]!.story)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^准备普通对照教学/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.getByRole("region", { name: "魔药教授能力边界" }).textContent).toContain("自愿参加的成年人");
    expect(screen.queryByRole("region", { name: "辅助药与实际结果" })).toBeNull();
  });

  it("locks interactions for busy, blocked and all save-error forms without changing public inventory", () => {
    const value = professor({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "quiet-passage" }, "观察原通道"),
      action({ type: "BUY_KIT" }, "补购G材料"), action({ type: "BREW_ASSISTANCE", kind: "QUIET_STEP" }, "配制静步药")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: "保存失败" },
      { busy: false, error: { message: "保存失败", retryable: true } }, { busy: false, error: { message: "版本不一致", retryable: false } }]) {
      rerender(<PotionProfessorPanel potionProfessor={value} resources={resources} onCommand={onCommand} {...props} />);
      for (const selector of screen.getAllByRole("combobox")) expect((selector as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.laboratory.materials)).toBeTruthy();
    }
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps optional Ewan talk and ordinary short-club combat separate from three practices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与后门艾文交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴后门承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原后门仍可通行，本次辅助药效已经实际结束。";
    const { onCommand } = panel(professor({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限后门冲突" }));
    expect(encounter.getByText(/辅助药不额外提供战斗免伤或隐身/)).toBeTruthy();
    await userEvent.click(encounter.getByRole("button", { name: /^与后门艾文交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴后门承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "辅助药与实际结果" })).toBeNull();
  });

  it("shows public mastery, bounded abstract materials and peaceful completion without real recipes", () => {
    const abilities = [{ id: "moon.s6.support-potions", label: "有限辅助药", mastery: 23, description: "分别配制并实际使用辅助药原瓶。" },
      { id: "moon.s6.potion-teaching", label: "有限教学", mastery: 41, description: "尊重成人学员意愿与实际理解。" }];
    panel(professor({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("有限辅助药 · 掌握 23")).toBeTruthy(); expect(screen.getByText("有限教学 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "魔药教授能力边界" });
    for (const text of ["三项主实践可和平完成", "材料包100便士", "4份教学灵性材料", "有限3包", "每次配制1行动、2灵性与1份材料", "失败仍消耗材料和灵性"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /现实配方|跨级晋升|战斗免伤|无限隐身/ })).toBeNull();
  });

  it("preserves S7 stories, blood provision history, bottle IDs and abilities as a strictly read-only view", () => {
    const vampire: VampireProjection = {
      title: "吸血鬼", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原吸血鬼库存与耗用记录保留。", story: "旧通道的静步练习与供血承诺仍有记录。", environment: "旧遮阴路线与本人选择保留。",
      bloodSummary: "已购买6份，实际耗用5份，仍持有1份；上次供血在第32周。",
      practices: [{ id: "blood-samples", title: "来源清楚的血液", story: "原来源、购买与供血代价保留。", status: "已完成，旧尝试保留" }],
      actions: [actionForVampire("BUY_BLOOD"), actionForVampire("FEED"), actionForVampire("REFLECT")],
      bottles: [{ id: "vampire-old", title: "吸血鬼旧原瓶", source: "吸血鬼原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "vampire-old", confirmed: true } }],
      abilities: [{ id: "moon.s7.blood-scent", label: "原血液气味", mastery: 67, description: "保留有限辨别与已知来源边界。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<PotionProfessorVampireHistory vampire={vampire} />);
    const history = within(screen.getByRole("region", { name: "吸血鬼时期的经历" }));
    for (const text of [vampire.story!, vampire.supplies, vampire.environment, vampire.bloodSummary, vampire.practices[0]!.story,
      "实践ID：blood-samples", "原瓶ID：vampire-old", "来源：吸血鬼原独立成品渠道", "已耗用 · 原失败保留",
      "原血液气味 · 掌握 67：保留有限辨别与已知来源边界。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});

function actionForVampire(type: "BUY_BLOOD" | "FEED" | "REFLECT"): VampireProjection["actions"][number] {
  return { id: `old-${type}`, label: `不可在历史执行${type}`, enabled: true, reason: null, cost: "公开旧成本", command: { type } };
}
