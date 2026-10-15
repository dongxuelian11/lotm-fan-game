/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShepherdAction, ShepherdCommand, ShepherdProjection } from "../../src/domain/shepherd/types";
import type { RoseBishopProjection } from "../../src/domain/rose-bishop/types";
import { ShepherdPanel, ShepherdRoseBishopHistory } from "../../src/renderer/ShepherdPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 100,
  cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "原创G：意志难度26。蔷薇主教消化100且晋升后满12整周；大成功精神−5、成功精神−10、失败精神−20健康−10、灾难精神−40健康−20；原瓶实际耗用，指导保护不适用于战斗。";
function action(command: ShepherdCommand, label = "执行公开行动", enabled = true, cost = "公开成本"): ShepherdAction {
  return { id: JSON.stringify(command), command, label, enabled, cost, reason: enabled ? null : "公开条件尚未满足。" };
}
function shepherd(patch: Partial<ShepherdProjection> = {}): ShepherdProjection {
  return { title: "牧羊人晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "", actions: [], bottles: [], abilities: [], acting: 0, digestion: "蔷薇主教消化100，晋升后满12整周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, grazing: null, ...patch };
}
function cases(): ShepherdProjection["cases"] {
  return [
    { id: "paper-guidance", title: "获准原纸的两米移动", story: "同一原纸SH5-PAPER-1仍在桌上，导师允许有限移到两米外标记。" },
    { id: "willing-chorus", title: "文森自愿参与的有限歌声", story: "成年文森在两米外明确同意本次短歌，无其他听众，可以拒绝。" },
    { id: "limited-account", title: "仅记录已经观察的事实", story: "将已观察记录写在同一原笔记SH5-NOTE-1上。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未接触", closes: 0 }));
}
const practice: NonNullable<ShepherdProjection["practice"]> = {
  paper: "原纸SH5-PAPER-1在桌上。", chorus: "本人尚未唱歌，文森仍可自由拒绝。",
  note: "同一原笔记SH5-NOTE-1尚未书写。", position: "本人在原桌前。", history: [],
};
function grazing(acquired = false): NonNullable<ShepherdProjection["grazing"]> {
  return { met: true, capacity: 7, activeSpiritId: acquired ? "SH5-IRIS-1" : null, summary: "本次实际会面只有两名原灵，没有免费补满名册。", spirits: [
    { id: "SH5-IRIS-1", name: "伊芮斯", status: acquired ? "GRAZED" : "AVAILABLE", source: "已故成年巫师原灵，原导师第一独立容器；与活着的伊蕾无关。",
      selectedAbilities: acquired ? ["light-touch", "brief-ward", "blur-mark"] : [], attemptWeek: acquired ? 65 : null, acquiredWeek: acquired ? 65 : null, releasedWeek: null,
      knownAbilities: [{ id: "light-touch", label: "微力触动", description: "她实际学会的有限原纸牵引。" },
        { id: "brief-ward", label: "短促防护", description: "她实际学会的有限防护。" }, { id: "blur-mark", label: "模糊标记", description: "她实际学会的有限模糊方法。" }] },
    { id: "SH5-CEDRIC-1", name: "塞德里克", status: acquired ? "GRAZED" : "AVAILABLE", source: "已故成年歌颂者原灵，另一独立原容器；只实际掌握一项方法。",
      selectedAbilities: acquired ? ["courage-song"] : [], attemptWeek: acquired ? 66 : null, acquiredWeek: acquired ? 66 : null, releasedWeek: null,
      knownAbilities: [{ id: "courage-song", label: "勇气歌声", description: "只以本人实际声音作有限鼓舞。" }] },
  ] };
}
function reserve(): NonNullable<ShepherdProjection["reserve"]> {
  return { points: 1, max: 3, packetsBought: 2, lastPurchaseWeek: 60, summary: "原序列6供给与储备延续，无晋升赠包。", packets: [
    { id: "RB6-packet-1", acquiredWeek: 40, status: "CONSUMED", consumedWeek: 42 },
    { id: "RB6-packet-2", acquiredWeek: 60, status: "HELD", consumedWeek: null },
  ] };
}
function bottled(): ShepherdProjection {
  const bottles = [1, 2, 3].map((number) => ({ id: `shepherd-potion-${number}`, title: `第${number}瓶牧羊人魔药`,
    source: `独立原渠道第${number}瓶的实际来源`, status: "已取得，尚未服用", chance: 40 + number,
    command: { type: "CONSUME" as const, bottleId: `shepherd-potion-${number}`, confirmed: true as const } }));
  return shepherd({ bottles, actions: bottles.map((bottle) => action(bottle.command, `服用原瓶${bottle.id}`, true, "0行动 · 消耗这一原瓶")) });
}
function panel(value: ShepherdProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ShepherdPanel shepherd={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
const releaseIris = () => action({ type: "RELEASE_SPIRIT", spiritId: "SH5-IRIS-1", confirmed: true }, "准备释放伊芮斯", true, "0行动 · 永久失去这一原灵");
afterEach(cleanup);

describe("Shepherd public roster, separate confirmations, originals and inherited reserve", () => {
  it("keeps the full formula and ritual unknown and forwards each acquisition intent unchanged", async () => {
    const commands: ShepherdCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "shepherd-potion-3" },
      { type: "BUY_POTION", bottleId: "shepherd-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付清第三瓶余款", "申请下一批", "登记真实到货"];
    const costs = ["1行动 · 460便士", "5步劳务 · 抵4200便士", "600便士", "1行动 · 等待下一周", "0行动"];
    const { onCommand, container } = panel(shepherd({ formula: [{ name: "不应泄露的假配方", quantity: 3, unit: "克" }],
      actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    expect(screen.getByRole("region", { name: "牧羊人成长下一步" }).textContent).toContain("蔷薇主教6 → 牧羊人5");
    expect(container.textContent).toContain("不能据此断言无需仪式");
    expect(container.textContent).not.toContain("不应泄露的假配方");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    costs.forEach((cost) => expect(screen.getByText(cost)).toBeTruthy());
  });

  it("cancels every independent bottle without consumption and restores its keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["shepherd-potion-1", "shepherd-potion-2", "shepherd-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3"); expect(screen.getByText(id)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "永久释放这一灵魂的独立确认" })).toBeNull();
      if (id.endsWith("2")) await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the original bottle risk and actual resources, dispatching only the exact selected bottle once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("shepherd-potion-2"));
    expect(screen.getByText("42%")).toBeTruthy(); expect(screen.getByText("来源：独立原渠道第2瓶的实际来源")).toBeTruthy();
    expect(screen.getByRole("region", { name: "牧羊人服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"].forEach((text) => expect(current.getByText(text)).toBeTruthy());
    const confirm = screen.getByRole("button", { name: "确认服用「第2瓶牧羊人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the bottle confirmation pending after save failure and only closes on a committed result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("shepherd-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第1瓶牧羊人魔药」" }));
    rerender(<ShepherdPanel shepherd={value} resources={resources} busy={false} error={{ message: "原瓶操作保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("重试同一原意图");
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(screen.getByRole("button", { name: "确认服用「第1瓶牧羊人魔药」" }));
    rerender(<ShepherdPanel shepherd={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第1瓶牧羊人魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原瓶已耗用，失败保留" } : bottle) };
    rerender(<ShepherdPanel shepherd={failed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶牧羊人魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗用，失败保留")).toBeTruthy();
    await userEvent.click(bottleButton("shepherd-potion-3"));
    expect(screen.getByText("shepherd-potion-3")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("does not expose soul identities, ability names or controls before a real public meeting", async () => {
    const meet = action({ type: "MEET_SPIRITS" }, "实际会面原导师介绍的灵魂", true, "1行动");
    const hidden = { ...grazing(), met: false, summary: "尚未实际会面。" };
    const value = shepherd({ promoted: true, grazing: hidden, actions: [meet,
      action({ type: "GRAZE", spiritId: "SH5-IRIS-1", abilityIds: ["light-touch"] }, "尚未公开的牵引放牧"), releaseIris()] });
    const { onCommand, container } = panel(value);
    expect(container.textContent).not.toMatch(/SH5-IRIS-1|SH5-CEDRIC-1|伊芮斯|塞德里克|微力触动|短促防护|模糊标记|勇气歌声/);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^实际会面原导师/ }));
    expect(onCommand.mock.calls[0]![0]).toBe(meet.command);
    expect(container.textContent).toContain("尚未实际会面");
  });

  it("shows only the two actual sources and passes their finite projected selections without creating extra spirits", async () => {
    const commands: ShepherdCommand[] = [
      { type: "GRAZE", spiritId: "SH5-IRIS-1", abilityIds: ["light-touch", "brief-ward", "blur-mark"] },
      { type: "GRAZE", spiritId: "SH5-IRIS-1", abilityIds: ["light-touch"] },
      { type: "GRAZE", spiritId: "SH5-CEDRIC-1", abilityIds: ["courage-song"] },
    ];
    const labels = ["放牧伊芮斯并选择原三项", "放牧伊芮斯只选牵引", "放牧塞德里克唯一原歌声"];
    const { onCommand } = panel(shepherd({ promoted: true, grazing: grazing(), actions: commands.map((command, index) => action(command, labels[index]!, true, "1行动 · 3灵性 · 知识14")) }));
    const roster = within(screen.getByRole("region", { name: "放牧名册与当前驱使" }));
    expect(roster.getAllByRole("article")).toHaveLength(2);
    expect(roster.getByRole("heading", { name: "实际灵魂名册 · 已放牧 0 / 7" })).toBeTruthy();
    expect(roster.getByText("当前驱使：无，仅使用自身能力")).toBeTruthy();
    for (const label of labels) await userEvent.click(roster.getByRole("button", { name: new RegExp(`^${label}`) }));
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(roster.getByRole("heading", { name: "实际灵魂名册 · 已放牧 0 / 7" })).toBeTruthy();
    expect(roster.getAllByText("已选能力 0 / 3：尚未选择")).toHaveLength(2);
  });

  it("renders saved selected methods and a single active soul, with zero-cost exact switching and deactivation", async () => {
    const activate = action({ type: "ACTIVATE_SPIRIT", spiritId: "SH5-CEDRIC-1" }, "切换驱使塞德里克", true, "0行动 · 0灵性");
    const own = action({ type: "ACTIVATE_SPIRIT", spiritId: null }, "停止驱使，只用自身能力", true, "0行动 · 0灵性");
    const value = shepherd({ promoted: true, grazing: grazing(true), actions: [activate, own] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("当前驱使：伊芮斯")).toBeTruthy();
    expect(screen.getByText("已选能力 3 / 3：微力触动、短促防护、模糊标记")).toBeTruthy();
    expect(screen.getByText("已选能力 1 / 3：勇气歌声")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^切换驱使/ }));
    expect(screen.getByText("当前驱使：伊芮斯")).toBeTruthy();
    rerender(<ShepherdPanel shepherd={{ ...value, grazing: { ...value.grazing!, activeSpiritId: "SH5-CEDRIC-1" } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前驱使：塞德里克")).toBeTruthy(); expect(screen.getAllByText("正在驱使这一灵魂")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^停止驱使/ }));
    expect(onCommand.mock.calls[0]![0]).toBe(activate.command); expect(onCommand.mock.calls[1]![0]).toBe(own.command);
    expect(screen.queryByRole("button", { name: /放牧.*第[3-7]/ })).toBeNull();
  });

  it("opens an independent permanent-release confirmation, cancels at zero cost and restores the exact opener", async () => {
    const release = releaseIris(); const { onCommand } = panel(shepherd({ promoted: true, grazing: grazing(true), actions: [release] }));
    const opener = () => screen.getByRole("button", { name: /^准备释放伊芮斯/ });
    opener().focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement?.tagName).toBe("H3");
    const confirmation = screen.getByRole("region", { name: "永久释放这一灵魂的独立确认" });
    expect(confirmation.textContent).toContain("永久失去这一灵魂及其已选能力的使用权");
    expect(confirmation.textContent).toContain("不能撤销、重新取得或换回");
    expect(confirmation.textContent).toContain("这不是复活");
    expect(confirmation.textContent).toContain("同时停止驱使");
    expect(screen.queryByRole("region", { name: "这瓶牧羊人魔药的服用确认" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(opener());
    await userEvent.click(opener()); await userEvent.click(screen.getByRole("button", { name: "保留这一灵魂" }));
    expect(document.activeElement).toBe(opener()); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText("当前驱使：伊芮斯")).toBeTruthy();
  });

  it("retains the exact release target through failed save retry and never resubmits or changes its target", async () => {
    const release = releaseIris(); const value = shepherd({ promoted: true, grazing: grazing(true), actions: [release] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备释放伊芮斯/ }));
    const confirm = () => screen.getByRole("button", { name: "确认永久释放「伊芮斯」" });
    fireEvent.click(confirm()); fireEvent.click(confirm());
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command); expect(onCommand.mock.calls[0]![0]).toBe(release.command);
    rerender(<ShepherdPanel shepherd={value} resources={resources} busy={false} error={{ message: "释放保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("释放保存失败");
    expect((screen.getByRole("button", { name: "保留这一灵魂" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(confirm());
    expect(screen.getByText("原灵魂ID：SH5-IRIS-1")).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ShepherdPanel shepherd={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    const released = { ...value.grazing!, activeSpiritId: null, spirits: value.grazing!.spirits.map((spirit) => spirit.id === "SH5-IRIS-1" ? { ...spirit, status: "RELEASED", releasedWeek: 68 } : spirit) };
    rerender(<ShepherdPanel shepherd={{ ...value, grazing: released, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "永久释放这一灵魂的独立确认" })).toBeNull();
    expect(screen.getByText("当前驱使：无，仅使用自身能力")).toBeTruthy();
    expect(screen.getByText("已选能力 3 / 3：微力触动、短促防护、模糊标记")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "实际灵魂名册 · 已放牧 1 / 7" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps released sources as history and suppresses stale reacquire, activate and release controls", () => {
    const saved = grazing(true); saved.spirits[0] = { ...saved.spirits[0]!, status: "RELEASED", releasedWeek: 68 }; saved.activeSpiritId = null;
    const { onCommand } = panel(shepherd({ promoted: true, grazing: saved, actions: [releaseIris(),
      action({ type: "GRAZE", spiritId: "SH5-IRIS-1", abilityIds: ["light-touch"] }, "不可重新取得"),
      action({ type: "ACTIVATE_SPIRIT", spiritId: "SH5-IRIS-1" }, "不可驱使已释放原灵"),
      action({ type: "GRAZE", spiritId: "invented-3", abilityIds: ["unknown-power"] }, "不存在第三原灵"),
    ] }));
    expect(screen.getByRole("article", { name: "原灵魂 SH5-IRIS-1" }).textContent).toContain("只保留历史选择");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("revokes unsubmitted release when its committed source is gone and respects changed public eligibility", async () => {
    const release = releaseIris(); const value = shepherd({ promoted: true, grazing: grazing(true), actions: [release] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备释放伊芮斯/ }));
    const reason = "须先实际结束当前接触。";
    rerender(<ShepherdPanel shepherd={{ ...value, actions: [{ ...release, enabled: false, reason }] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认永久释放「伊芮斯」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "保留这一灵魂" }));
    rerender(<ShepherdPanel shepherd={value} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^准备释放伊芮斯/ }));
    rerender(<ShepherdPanel shepherd={{ ...value, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "永久释放这一灵魂的独立确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects all three public cases and forwards preparation and performance without optimistic changes", async () => {
    const commands: ShepherdCommand[] = [{ type: "OBSERVE", caseId: "paper-guidance" },
      { type: "PREPARE", caseId: "paper-guidance", method: "ORDINARY" }, { type: "PREPARE", caseId: "paper-guidance", method: "ABILITY" },
      { type: "PERFORM", caseId: "paper-guidance" }, { type: "WITHDRAW", caseId: "paper-guidance" }, { type: "REPORT", caseId: "paper-guidance" }];
    const labels = ["核对原纸", "准备普通步行", "准备借用牵引", "实际执行", "撤回准备", "提交有限报告"];
    const { onCommand } = panel(shepherd({ promoted: true, cases: cases(), practice,
      actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "paper-guidance");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    [practice.paper, practice.chorus, practice.note, practice.position].forEach((text) => expect(screen.getByText(text)).toBeTruthy());
    expect(screen.queryByRole("region", { name: "牧羊人实际结果" })).toBeNull();
  });

  it("prioritizes actual performance over withdrawal while a preparation is still outside contact", () => {
    const perform = action({ type: "PERFORM", caseId: "willing-chorus" }, "实际开始本次自愿歌声");
    panel(shepherd({ promoted: true, cases: cases().map((entry) => entry.id === "willing-chorus" ? { ...entry, status: "PREPARED" } : entry), practice,
      actions: [action({ type: "WITHDRAW", caseId: "willing-chorus" }, "撤回尚未发生的准备"), perform] }));
    expect(screen.getByRole("region", { name: "牧羊人成长下一步" }).textContent).toContain(`下一步：${perform.label}`);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText(practice.chorus)).toBeTruthy();
  });

  it.each(["paper-guidance", "willing-chorus", "limited-account"])("keeps the zero-resource %s close available and hides all competing mutations", async (caseId) => {
    const close = action({ type: "CLOSE", caseId }, "实际收束这一原现场", true, "0行动 · 0精神 · 0灵性");
    const value = shepherd({ promoted: true, insideCase: true, grazing: grazing(true), reserve: reserve(), cases: cases(), practice,
      actions: [close, releaseIris(), action({ type: "ACTIVATE_SPIRIT", spiritId: null }, "不得中途切换"),
        action({ type: "BUY_RATION" }, "不得中途买包"), action({ type: "ENCOUNTER_FIGHT" }, "不得中途开战"),
        action({ type: "REPORT", caseId }, "不得未结束先报告")] });
    const { onCommand } = renderWithZeroResources(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(caseId);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const button = screen.getByRole("button", { name: /^实际收束这一原现场/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); await userEvent.click(button);
    expect(onCommand.mock.calls[0]![0]).toBe(close.command);
    expect(screen.getByText(/先用0行动、0精神、0灵性的结束选项/).textContent).toContain("最后行动耗尽仍可结束");
  });

  it("retains failed song and written original evidence after actual closing instead of refunding or duplicating", async () => {
    const failure = "已尝试歌唱并耗2灵性，文森表示拒绝；记录只记此次实际反馈。";
    const close = action({ type: "CLOSE", caseId: "willing-chorus" }, "停止本人的真实声音");
    const value = shepherd({ promoted: true, cases: cases().map((entry) => entry.id === "willing-chorus" ? { ...entry, status: "EXAMINED", result: failure } : entry),
      insideCase: true, actions: [close], practice: { ...practice, chorus: "本人实际歌声仍未收束。", history: [failure] } });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("本人实际歌声仍未收束。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^停止本人的真实声音/ }));
    expect(screen.getByText("本人实际歌声仍未收束。")).toBeTruthy();
    rerender(<ShepherdPanel shepherd={{ ...value, insideCase: false, actions: [], practice: { ...value.practice!, chorus: "本人已经实际停唱，文森原拒绝保留。" } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("本人已经实际停唱，文森原拒绝保留。")).toBeTruthy();
    expect(screen.getAllByText(failure)).toHaveLength(2); expect(onCommand.mock.calls[0]![0]).toBe(close.command);
  });

  it("uses the inherited actual packets and reserve with original commands and no optimistic replenishment", async () => {
    const buy = action({ type: "BUY_RATION" }, "购买一份原渠道补给", true, "1行动 · 40便士 · 本周仅一份");
    const take = action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "取用第二原包", true, "1行动 · 储备+1");
    const value = shepherd({ promoted: true, reserve: reserve(), actions: [buy, take,
      action({ type: "TAKE_RATION", packetId: "RB6-packet-1" }, "不得重复耗用"),
      action({ type: "TAKE_RATION", packetId: "missing" }, "不得生成原包")] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /^购买一份原渠道/ }));
    await userEvent.click(screen.getByRole("button", { name: /^取用第二原包/ }));
    expect(onCommand.mock.calls[0]![0]).toBe(buy.command); expect(onCommand.mock.calls[1]![0]).toBe(take.command);
    expect(screen.getByRole("heading", { name: "血肉储备 1 / 3" })).toBeTruthy(); expect(screen.getByText("实际持有 · 尚未取用")).toBeTruthy();
    rerender(<ShepherdPanel shepherd={{ ...value, actions: [], reserve: { ...value.reserve!, points: 2,
      packets: value.reserve!.packets.map((packet) => packet.id === "RB6-packet-2" ? { ...packet, status: "CONSUMED", consumedWeek: 68 } : packet) } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("heading", { name: "血肉储备 2 / 3" })).toBeTruthy();
    expect(screen.getByText("已实际耗用 · 耗用周：42")).toBeTruthy(); expect(screen.getByText("已实际耗用 · 耗用周：68")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("displays exact public weekly and reserve-cap reasons without inferring new permissions", () => {
    const weekly = { ...action({ type: "BUY_RATION" }, "本周已买原包", false), reason: "须等下一真实周。" };
    const capped = { ...action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "储备已满", false), reason: "当前3点储备已满，不耗原包。" };
    const { onCommand } = panel(shepherd({ promoted: true, reserve: { ...reserve(), points: 3 }, actions: [weekly, capped] }));
    [weekly.reason, capped.reason].forEach((text) => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
    screen.getAllByRole("button").forEach((button) => { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks every mutation and selector while busy, blocked or waiting for original save retry", () => {
    const value = shepherd({ promoted: true, cases: cases(), grazing: grazing(true), reserve: reserve(), actions: [releaseIris(),
      action({ type: "ACTIVATE_SPIRIT", spiritId: null }, "停止驱使"), action({ type: "BUY_RATION" }, "购买原包"),
      action({ type: "OBSERVE", caseId: "paper-guidance" }, "观察原纸")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<ShepherdPanel shepherd={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      screen.getAllByRole("button").forEach((button) => { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); });
      expect(screen.getByText("当前驱使：伊芮斯")).toBeTruthy(); expect(screen.getByRole("heading", { name: "血肉储备 1 / 3" })).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards optional encounter intents and keeps death, single-soul borrowing and peaceful completion honest", async () => {
    const commands: ShepherdCommand[] = [{ type: "ENCOUNTER_TALK" }, { type: "ENCOUNTER_FIGHT" }];
    const { onCommand } = panel(shepherd({ promoted: true, acting: 100, digestion: "本阶段已消化", grazing: grazing(true),
      actions: commands.map((command, index) => action(command, index === 0 ? "与埃尔顿交涉" : "承担门廊冲突")) }));
    const encounter = screen.getByRole("region", { name: "牧羊人有限冲突" });
    expect(encounter.textContent).toContain("对方不追击"); expect(encounter.textContent).toContain("死亡不会自动给玩家捕获新灵魂");
    expect(encounter.textContent).toContain("每轮只驱使当前选中的一灵");
    expect(screen.getByRole("progressbar", { name: "牧羊人扮演进度" }).getAttribute("value")).toBe("100");
    await userEvent.click(screen.getByRole("button", { name: /^与埃尔顿交涉/ })); await userEvent.click(screen.getByRole("button", { name: /^承担门廊冲突/ }));
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.queryByRole("button", { name: /黑骑士|灵肉之刃|统御阴影|复活/ })).toBeNull();
  });

  it("preserves S6 originals, old failed results and mastery as history without executing any old actions", () => {
    const old: RoseBishopProjection = {
      title: "蔷薇主教", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原成品供给历史。", story: "原蔷薇主教故事。", environment: "原身体已恢复正常。", risk: "原风险", acting: 100, digestion: "已消化", pollution: 4,
      insideCase: false, practice: { shape: "NORMAL" }, reserve: reserve(),
      cases: [{ id: "ring-release", title: "原环的实际解除", story: "旧原环未复制。", status: "RESOLVED", observations: ["原环和边界已核对。"],
        preparation: "原普通方法。", result: "原失败及之后结束记录保留。", contactOpen: "已实际结束", closes: 2 }],
      actions: [{ id: "old-reflect", label: "不允许重刷旧报告", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
      bottles: [{ id: "rose-bishop-potion-1", title: "原序列6成品", source: "原独立蔷薇主教渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "rose-bishop-potion-1", confirmed: true } }],
      abilities: [{ id: "hanged-man.s6.flesh-shaping", label: "原本人血肉变化", mastery: 47, description: "实际掌握保持47。" }],
    };
    render(<ShepherdRoseBishopHistory roseBishop={old} />);
    const history = within(screen.getByRole("region", { name: "蔷薇主教时期的经历" }));
    ["原蔷薇主教故事。", "原成品供给历史。", "旧原环未复制。", "原环和边界已核对。", "原案卷ID：ring-release",
      "当时的方式与准备：原普通方法。", "当时的实际结果与报告：原失败及之后结束记录保留。", "原瓶ID：rose-bishop-potion-1",
      "来源：原独立蔷薇主教渠道", "已耗用 · 原失败保留", "原本人血肉变化 · 掌握 47：实际掌握保持47。"].forEach((text) => expect(history.getByText(text)).toBeTruthy());
    expect(history.getByText("原包ID：RB6-packet-1 · 已实际耗用")).toBeTruthy();
    expect(history.getByText("原包ID：RB6-packet-2 · 实际持有")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不允许重刷旧报告")).toBeNull();
  });
});

function renderWithZeroResources(value: ShepherdProjection) {
  const onCommand = vi.fn();
  return { onCommand, ...render(<ShepherdPanel shepherd={value} resources={{ ...resources, mind: 0, spirituality: 0, actionsRemaining: 0 }} busy={false} onCommand={onCommand} />) };
}
