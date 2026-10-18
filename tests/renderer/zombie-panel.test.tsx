/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZombieAction, ZombieCommand, ZombieProjection } from "../../src/domain/zombie/types";
import type { WerewolfProjection } from "../../src/domain/werewolf/types";
import { ZombiePanel, ZombieWerewolfHistory } from "../../src/renderer/ZombiePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，原排异和污染保留，可休养后另取独立成品重试。";
function action(command: ZombieCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): ZombieAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取活尸成品用药指导", true, "360便士 · 1行动");
function zombie(patch: Partial<ZombieProjection> = {}): ZombieProjection {
  return {
    title: "活尸晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "狼人扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: { body: "NORMAL", cold: "NONE", spirit: "ABSENT" },
    moon: { pending: false, summary: "下一场已公示月圆为第51周。", history: [] }, ...patch,
  };
}
function cases(): ZombieProjection["cases"] {
  return [
    { id: "narrow-load", title: "原窄道中的本人承力", story: "本人沿原窄道承受已登记负荷，原卸载处仍可使用。" },
    { id: "cold-tray", title: "同一原冷盘的有限寒冷", story: "原浅盘、托架与回温处都仍在，不凭空换成另一只盘。" },
    { id: "willing-spirit", title: "赫姆自愿提供的有限指认", story: "原有成年幽魂赫姆已同意有限协助，仍须核对他的指认。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): ZombieProjection {
  const originals = [
    { id: "zombie-potion-1", title: "第一瓶活尸魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "zombie-potion-2", title: "第二瓶活尸魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "zombie-potion-3", title: "第三瓶活尸魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return zombie({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "此前承力未成功，原消耗与失败记录继续保留。";
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(): ZombieProjection {
  return zombie({ promoted: true, insideCase: true, practice: { body: "BRACED", cold: "NONE", spirit: "ABSENT" },
    cases: cases().map((entry) => entry.id === "narrow-load" ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本人仍在承受同一原负荷；须实际卸载并放松承力。", contactOpen: "本次承力尚未收束" } : entry),
    actions: [action({ type: "CLOSE", caseId: "narrow-load" }, "在原卸载处放松承力", true, zeroClose)],
  });
}
function panel(value: ZombieProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ZombiePanel zombie={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Zombie public practice, moon costs and original bottle confirmation", () => {
  it("keeps the next step short and shows maturity, costs and unverified formula only as bounded records", () => {
    const reason = "狼人扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原指导者保管三瓶独立成品，本瓶完成4/5步劳务。";
    const { onCommand } = panel(zombie({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "活尸成长下一步" });
    expect(summary.textContent).toContain(reason); expect(summary.textContent).not.toContain("5步劳务");
    const boundary = screen.getByText("成品来源、费用与配方边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["狼人消化100", "十二个完整序列7周", "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "完整晋升配方、材料与剂量尚未掌握；这里只提供有来源的独立成品，用药指导不解锁调配。"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取活尸成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards independent guidance, labour, payment and resupply intents exactly", async () => {
    const commands: ZombieCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "zombie-potion-3" },
      { type: "BUY_POTION", bottleId: "zombie-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付款领取第二瓶", "请求后续独立原瓶", "实际接收次周补给"];
    const { onCommand } = panel(zombie({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
  });

  it("cancels each independent original without spending and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶活尸魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶活尸魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶活尸魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶活尸魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶活尸魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows this bottle source, four-tier risk and saved resources before a single exact confirmation", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶活尸魔药」" }));
    expect(screen.getByText("zombie-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    const riskRegion = screen.getByRole("region", { name: "活尸服用风险与四档结果" });
    for (const text of [risk, "新月圆诅咒替代", "剧痛并暂时不能战斗", "不会永久解除诅咒"]) expect(riskRegion.textContent).toContain(text);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶活尸魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "zombie-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains submitted identity during save failure and permits only the outer same-operation retry", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶活尸魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶活尸魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<ZombiePanel zombie={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶活尸魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("zombie-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<ZombiePanel zombie={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ZombiePanel zombie={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶活尸魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains consumed failure history and offers a different original only after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶活尸魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶活尸魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原瓶已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<ZombiePanel zombie={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原瓶已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶活尸魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶活尸魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("zombie-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation on saved promotion and keeps all three originals read-only", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶活尸魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶活尸魔药」" }));
    const promoted = { ...value, title: "活尸", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升活尸" } : bottle) };
    rerender(<ZombiePanel zombie={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶活尸魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升活尸")).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`原瓶ID：${bottle.id}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects each original practice and forwards exact methods without optimistic cold or spirit", async () => {
    const commands: ZombieCommand[] = [{ type: "OBSERVE", caseId: "narrow-load" }, { type: "PREPARE", caseId: "narrow-load", method: "ORDINARY" },
      { type: "PREPARE", caseId: "narrow-load", method: "ABILITY" }, { type: "PERFORM", caseId: "narrow-load" },
      { type: "WITHDRAW", caseId: "narrow-load" }, { type: "REPORT", caseId: "narrow-load" }];
    const labels = ["核对原负荷", "准备普通搬运", "准备本人承力", "实际承力一次", "撤回未执行准备", "提交有限报告"];
    const { onCommand } = panel(zombie({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "活尸实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "narrow-load");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前承力、凝霜或建立幽魂接触");
    expect(screen.getByText("当前本人身体：本人处于日常姿态")).toBeTruthy();
    expect(screen.getByText("当前原冷盘：原冷盘尚无本次薄霜")).toBeTruthy(); expect(screen.getByText("当前幽魂接触：本次尚未接触赫姆")).toBeTruthy();
  });

  it("pins the actual contact to its zero-cost CLOSE even with no resources and stale other actions", async () => {
    const { onCommand, rerender } = panel(zombie({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "willing-spirit"); const value = opened();
    rerender(<ZombiePanel zombie={{ ...value, actions: [action({ type: "CLOSE", caseId: "cold-tray" }, "旧盘记录不能结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "narrow-load" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "narrow-load" }, "不可撤回代替卸载"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("narrow-load"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^在原卸载处放松承力/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "narrow-load" });
    expect(screen.getByText(originalFailure)).toBeTruthy(); expect(screen.getByText("当前本人身体：本人仍在承受原负荷")).toBeTruthy();
  });

  it.each([
    { id: "narrow-load", before: { body: "BRACED", cold: "NONE", spirit: "ABSENT" }, after: { body: "NORMAL", cold: "NONE", spirit: "ABSENT" }, label: "卸下原负荷并放松承力", prior: "当前本人身体：本人仍在承受原负荷", next: "当前本人身体：本人处于日常姿态" },
    { id: "cold-tray", before: { body: "NORMAL", cold: "ICED", spirit: "ABSENT" }, after: { body: "NORMAL", cold: "THAWED", spirit: "ABSENT" }, label: "让同一原盘实际回温", prior: "当前原冷盘：同一原冷盘仍有本次薄霜", next: "当前原冷盘：同一原冷盘已实际回温" },
    { id: "willing-spirit", before: { body: "NORMAL", cold: "NONE", spirit: "PRESENT" }, after: { body: "NORMAL", cold: "NONE", spirit: "RELEASED" }, label: "解除与原有赫姆的本次接触", prior: "当前幽魂接触：原有幽魂赫姆仍在本次有限接触中", next: "当前幽魂接触：已实际解除与赫姆的本次接触" },
  ] as const)("keeps $id actual state until saved CLOSE and retains the original result", async ({ id, before, after, label, prior, next }) => {
    const result = `${id}实际结果保留，不退款也不改写原失败。`;
    const value = zombie({ promoted: true, insideCase: true, practice: before,
      cases: cases().map((entry) => entry.id === id ? { ...entry, result, status: "EXAMINED", contactOpen: "本次接触仍未结束" } : entry),
      actions: [action({ type: "CLOSE", caseId: id }, label, true, zeroClose)] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(screen.getByText(prior)).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    rerender(<ZombiePanel zombie={{ ...value, insideCase: false, practice: after, actions: [],
      cases: value.cases.map((entry) => entry.id === id ? { ...entry, closes: 1, contactOpen: "已实际收束" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(next)).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy(); expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: id });
  });

  it("does not manufacture CLOSE, healed state or a report from historical prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "活尸成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(screen.getByText("当前本人身体：本人仍在承受原负荷")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("prioritizes pending moon, exposes real costs and blocks combat without inventing victims", async () => {
    const guarded = { ...action({ type: "HANDLE_MOON", method: "GUARDED" }, "在原工坊看守下度过发作", false, "0行动 · 0灵性 · 至多10精神"), reason: "须在贝克兰德原哈伦工坊。" };
    const alone = action({ type: "HANDLE_MOON", method: "ALONE" }, "在原地点独处度过发作", true, "0行动 · 0灵性 · 至多20精神");
    const value = zombie({ promoted: true, insideCase: true, cases: cases(), moon: { pending: true, summary: "第51周已公示月圆发作尚未结束。", history: [] },
      actions: [guarded, alone, action({ type: "REFLECT" }, "不应提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不应提前战斗"), action({ type: "OBSERVE", caseId: "cold-tray" }, "不应提前观察")] });
    const onCommand = vi.fn(); render(<ZombiePanel zombie={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "活尸成长下一步" }).textContent).toContain(alone.label);
    expect(screen.queryByRole("combobox")).toBeNull(); expect(screen.queryByRole("region", { name: "活尸有限冲突" })).toBeNull();
    const moon = within(screen.getByRole("group", { name: "本次活尸月圆处理选择" }));
    expect(moon.getByText(guarded.reason)).toBeTruthy(); expect((moon.getByRole("button", { name: new RegExp(`^${guarded.label}`) }) as HTMLButtonElement).disabled).toBe(true);
    expect((moon.getByRole("button", { name: new RegExp(`^${alone.label}`) }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByRole("button")).toHaveLength(2); expect(moon.getByText(alone.cost)).toBeTruthy();
    await userEvent.click(moon.getByRole("button", { name: new RegExp(`^${alone.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(alone.command);
    expect(screen.getByText("第51周已公示月圆发作尚未结束。")).toBeTruthy(); expect(screen.getByText(/节制带来的剧痛尚未结束/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /伤人|杀戮|吞噬|免费解咒|提前战斗/ })).toBeNull();
  });

  it("shows actual moon history only after save and resumes the projected next action", async () => {
    const guarded = action({ type: "HANDLE_MOON", method: "GUARDED" }, "在原哈伦工坊实际过夜", true, "0行动 · 0灵性 · 至多10精神");
    const value = zombie({ promoted: true, insideCase: true, moon: { pending: true, summary: "当前月圆尚未度过。", history: [] }, actions: [guarded] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^在原哈伦工坊实际过夜/ }));
    expect(screen.queryByText(/实际精神消耗10/)).toBeNull();
    const talk = action({ type: "ENCOUNTER_TALK" }, "与里德交涉", true, "1行动");
    rerender(<ZombiePanel zombie={{ ...value, insideCase: false, actions: [talk], moon: { pending: false, summary: "第51周发作已实际度过；下一场为第55周。", history: [{ week: 51, method: "GUARDED", mentalCost: 10 }] } }} resources={{ ...resources, mind: 78 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("第51周 · 原哈伦工坊看守过夜 · 实际精神消耗10")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "本次活尸月圆处理选择" })).toBeNull();
    expect(screen.getByRole("region", { name: "活尸成长下一步" }).textContent).toContain(talk.label);
    expect(screen.getByRole("button", { name: /^与里德交涉/ })).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(guarded.command);
  });

  it("does not infer a new moon from a four-week multiple or manufacture a moon handler", () => {
    panel(zombie({ promoted: true, digestion: "当前第52周，活尸扮演25。", actions: [], moon: { pending: false, summary: "下一场已公示G月圆为第55周。", history: [{ week: 51, method: "ALONE", mentalCost: 7 }] } }));
    expect(screen.getByText("下一场已公示G月圆为第55周。")).toBeTruthy(); expect(screen.getByText("第51周 · 原地点停止接触并独自过夜 · 实际精神消耗7")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "本次活尸月圆处理选择" })).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
    const boundary = screen.getByText("月圆代价与已公示事件").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["新诅咒替代狼人、疯子旧诅咒", "不按每四周推算", "当前精神与10中的较小值", "当前精神与20中的较小值", "精神为0仍可完成", "不治疗、不奖励", "不代表诅咒消失"])
      expect(boundary.textContent).toContain(text);
  });

  it("keeps moon pending without inventing an action when the projection has no handler", () => {
    panel(zombie({ promoted: true, insideCase: true, actions: [], moon: { pending: true, summary: "当前发作尚未度过。", history: [] } }));
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "活尸成长下一步" }).textContent).toContain("查看当前公开月圆处理选项");
  });

  it("locks mutations and selection during busy, blocked and failed-save states", () => {
    const value = zombie({ promoted: true, cases: cases(), practice: { body: "NORMAL", cold: "THAWED", spirit: "RELEASED" }, actions: [
      action({ type: "OBSERVE", caseId: "narrow-load" }, "观察原现场"), action({ type: "REFLECT" }, "反思原报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<ZombiePanel zombie={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("当前原冷盘：同一原冷盘已实际回温")).toBeTruthy(); expect(screen.getByText("当前幽魂接触：已实际解除与赫姆的本次接触")).toBeTruthy();
    }
    rerender(<ZombiePanel zombie={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains eight inherited masteries and two new records without showing private fields", () => {
    const inherited = ["prisoner-body", "sharp-senses", "escape-skill", "mad-burst", "mental-resist", "werewolf-body", "regeneration", "toxic-claws"].map((id, index) => ({
      id: `old-${id}`, label: `原能力${index + 1}`, mastery: 61 + index, description: "原实际掌握保留。",
    }));
    const value = { ...zombie({ promoted: true, acting: 100, actions: [], abilities: [...inherited,
      { id: "chained.s6.steel-body", label: "钢铁身体", mastery: 25, description: "有限身体防护。" },
      { id: "chained.s6.death-craft", label: "有限死亡魔法", mastery: 45, description: "寒冷与原有幽魂的有限协助。" },
    ] }), privateIntent: "HIDDEN_HOSTILE_PLAN_NEVER_RENDER" };
    panel(value); expect(screen.getByRole("heading", { name: "能力与消化 · 10 项训练记录" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "活尸扮演进度" }).getAttribute("value")).toBe("100");
    for (const ability of value.abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain(value.privateIntent); expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps finite consensual spirit and ability costs folded instead of promising resurrection or immunity", () => {
    const story = "有限能力有原著边界，原工坊与赫姆故事均为G原创。";
    panel(zombie({ promoted: true, story, actions: [], cases: cases() }));
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看承力、寒冷与幽魂边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["各耗1行动、3灵性", "普通方法耗1行动、0灵性", "观察、准备与报告各耗1行动", "原有幽魂赫姆只自愿提供有限协助", "不是复活死者、创造新幽魂", "不会给出全部真相", "太阳净化", "不治疗污染或诅咒", "三项报告各25扮演进度，反思25，属于有限和平成长；不保证无代价完成扮演，也不能解除月圆诅咒。本页活尸阶段不提供序列5怨魂的虚化、穿墙、镜面跳跃或附体。", "本页活尸阶段不提供序列5怨魂"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /复活|附体|镜面|穿墙|虚化|读取全部/ })).toBeNull();
  });

  it("forwards public Reed encounter choices without deriving hostile intent or a result", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "与里德交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担原现场冲突")];
    const { onCommand } = panel(zombie({ promoted: true, acting: 100, environment: "里德与原现场的出口仍在。", actions }));
    expect(screen.getByText("里德与原现场的出口仍在。")).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "活尸有限冲突" }));
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
    expect(screen.queryByText(/已击败里德|里德必然脆弱|免疫所有/)).toBeNull();
  });

  it("retains S7 failure, return, bottle and moon-cost history without any old mutation controls", () => {
    const werewolf: WerewolfProjection = {
      title: "狼人", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原狼人供给记录。", story: "原狼人故事。", environment: "原工坊爪痕现场。",
      cases: [{ id: "claw-mark", title: "原爪痕核对", story: "第一次检验失败。", status: "RESOLVED", observations: ["原木板仍在。"],
        preparation: "普通方法与原记录对照。", result: "实际返回后提交有限报告。", sceneOpen: "原接触已结束", returns: 2 }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "werewolf-original-1", title: "狼人旧原瓶", source: "独立狼人原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "werewolf-original-1", confirmed: true } }],
      abilities: [{ id: "chained.s7.toxic-claws", label: "原有毒爪牙", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      moon: { pending: false, summary: "狼人旧月相告示与原发作记录。", history: [{ week: 37, method: "GUARDED", mentalCost: 10 }, { week: 41, method: "ALONE", mentalCost: 8 }] },
    };
    render(<ZombieWerewolfHistory werewolf={werewolf} />);
    const historyRegion = screen.getByRole("region", { name: "狼人时期的经历" }); const history = within(historyRegion);
    for (const text of ["原狼人故事。", "原狼人供给记录。", "第一次检验失败。", "原木板仍在。", "原案卷ID：claw-mark", "原瓶ID：werewolf-original-1",
      "当时的方式与准备：普通方法与原记录对照。", "当时的现场：原接触已结束", "当时实际返回次数：2", "当时的实际结果与报告：实际返回后提交有限报告。",
      "来源：独立狼人原渠道", "已耗用 · 原失败保留", "原有毒爪牙 · 掌握 67：保留原能力实际掌握。", "狼人旧月相告示与原发作记录。",
      "第37周 · 原哈伦工坊看守过夜 · 原实际精神消耗10", "第41周 · 原地点独自过夜 · 原实际精神消耗8"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升活尸（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
    for (const details of historyRegion.querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
