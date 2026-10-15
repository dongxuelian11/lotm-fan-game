/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TravelerAction, TravelerCommand, TravelerProjection } from "../../src/domain/traveler/types";
import type { RecorderProjection } from "../../src/domain/recorder/types";
import { TravelerRecorderHistory, TravelerPanel } from "../../src/renderer/TravelerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；记录官消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: TravelerCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): TravelerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取旅行家成品用药指导", true, "460便士 · 1行动");
function traveler(patch: Partial<TravelerProjection> = {}): TravelerProjection {
  return {
    title: "旅行家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "记录官扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", ritual: null, practice: null, ...patch,
  };
}
function cases(): TravelerProjection["cases"] {
  return [
    { id: "known-landing", title: "已核对的落脚点", story: "本人沿六米普通路线实际查看落脚点和返回路线。" },
    { id: "offered-card", title: "同一张许可原卡", story: "TR5-CARD-1是导师桌上可见的木制图卡，许可取用后须实际归还。" },
    { id: "willing-companion", title: "在场成年人的同行", story: "成年场务米拉独立在场，只能当面同意本次六米有限同行。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalPractice: NonNullable<TravelerProjection["practice"]> = {
  position: "本人在原入口", card: "TR5-CARD-1仍在导师原桌上", companion: "米拉在原入口，尚未接受本次同行", history: [],
};
const ritual: NonNullable<TravelerProjection["ritual"]> = {
  at: "原指导室", escortSpirituality: 24, history: [], coordinates: [
    { id: "BRONZE_STEPS", label: "倒悬铜阶", status: "尚未亲自放置" },
    { id: "INVERTED_REEF", label: "反向礁海", status: "尚未亲自放置" },
    { id: "ASH_GARDEN", label: "无声灰园", status: "尚未亲自放置" },
    { id: "ECHO_WELL", label: "回音深井", status: "尚未亲自放置" },
  ],
};
function bottled(): TravelerProjection {
  const originals = [
    { id: "traveler-potion-1", title: "第一瓶旅行家魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "traveler-potion-2", title: "第二瓶旅行家魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "traveler-potion-3", title: "第三瓶旅行家魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return traveler({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方未知，须实际完成四处特殊坐标和返程。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): TravelerProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：旅行尝试未通过，已消耗5灵性，本人与米拉仍在入口。";
function opened(): TravelerProjection {
  return traveler({ promoted: true, insideCase: true, actions: [
    action({ type: "PERFORM", caseId: "willing-companion" }, "实际执行本次有限同行", true, "1行动 · 本次实际成本"),
    action({ type: "CLOSE", caseId: "willing-companion" }, "两人普通步行返回并结束", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "WITHDRAW", caseId: "willing-companion" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
  ], cases: cases().map((entry) => entry.id === "willing-companion" ? {
    ...entry, status: "EXAMINED", observations: ["本次已核对米拉当面同意。", failure],
    preparation: "已准备本次有限同行。", contactOpen: "本次接触尚未实际结束",
  } : entry), practice: { ...originalPractice, position: "本人在已核对的落脚点", companion: "米拉在同一落脚点，本次同意尚未结束", history: ["本人和米拉实际到达一次，尚未返回。"] } });
}
function panel(value: TravelerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<TravelerPanel traveler={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Traveler public rituals, actual positions and independent bottles", () => {
  it("shows the public S6 gate, G supply and actual ritual without inventing a recipe", () => {
    const reason = "记录官扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(traveler({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "旅行家成长下一步" });
    expect(summary.textContent).toContain("记录官6 → 旅行家5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方、材料、剂量与调配顺序仍未知");
    expect(summary.textContent).toContain("实际完成灵界深处四处特殊坐标");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取旅行家成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: TravelerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "traveler-potion-3" },
      { type: "BUY_POTION", bottleId: "traveler-potion-3" }, { type: "BUY_POTION", bottleId: "traveler-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(traveler({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["traveler-potion-1", "traveler-potion-2", "traveler-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "traveler-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-2"));
    expect(screen.getByText("traveler-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "旅行家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶旅行家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "旅行家能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶旅行家魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<TravelerPanel traveler={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶旅行家魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("traveler-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<TravelerPanel traveler={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<TravelerPanel traveler={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶旅行家魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶旅行家魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶旅行家魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<TravelerPanel traveler={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*traveler-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("traveler-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("traveler-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶旅行家魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶旅行家魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升旅行家" } : bottle) };
    rerender(<TravelerPanel traveler={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶旅行家魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "旅行家能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升旅行家")).toBeTruthy();
    expect(screen.getByText("原瓶ID：traveler-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-2"));
    expect(screen.getByText("traveler-potion-2")).toBeTruthy();
    rerender(<TravelerPanel traveler={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶旅行家魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<TravelerPanel traveler={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶旅行家魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all four independent coordinates and forwards each exact departure without moving optimistically", async () => {
    const commands: TravelerCommand[] = ritual.coordinates.map((site) => ({ type: "RITUAL_DEPART", site: site.id }));
    const value = traveler({ ritual, actions: commands.map((command, index) => action(command, `随艾文赴${ritual.coordinates[index]!.label}`, true, "1行动 · 80便士 · 艾文3灵性，保留返程3灵性")) });
    const { onCommand } = panel(value);
    const route = within(screen.getByRole("region", { name: "四处特殊坐标与实际返程" }));
    expect(route.getByText("24")).toBeTruthy(); expect(route.getByText("原指导室")).toBeTruthy();
    expect(route.getAllByText("尚未亲自放置", { exact: false })).toHaveLength(4);
    for (const site of ritual.coordinates) await userEvent.click(route.getByRole("button", { name: new RegExp(`^随艾文赴${site.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(route.getByText("原指导室")).toBeTruthy(); expect(route.getByText("24")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^放置坐标|^实际返程|^任意传送/ })).toBeNull();
  });

  it("keeps placement and the genuine reserved return at zero AP, preserving committed location until saved", async () => {
    const place = action({ type: "PLACE_COORDINATE" }, "本人亲自放置本处坐标", true, "0行动 · 本人2灵性");
    const back = action({ type: "RITUAL_RETURN" }, "随同一艾文实际返程", true, "0行动 · 艾文已保留3灵性");
    const away = { ...ritual, at: "本人在灵界深处倒悬铜阶", escortSpirituality: 21, history: ["第60周已付80便士并实际出发，尚未放置坐标。"] };
    const value = traveler({ ritual: away, insideCase: true, actions: [place, back] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("下一步：本人亲自放置本处坐标");
    await userEvent.click(screen.getByRole("button", { name: /^本人亲自放置本处坐标/ }));
    expect(screen.getAllByText("尚未亲自放置", { exact: false })).toHaveLength(4);
    const placed = { ...away, coordinates: away.coordinates.map((site, index) => index === 0 ? { ...site, status: "第60周本人已实际放置" } : site), history: [...away.history, "第60周实际放置，消耗本人2灵性；尚未返程。"] };
    rerender(<TravelerPanel traveler={{ ...value, ritual: placed, actions: [back] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("下一步：随同一艾文实际返程");
    expect(screen.getByText("第60周本人已实际放置", { exact: false })).toBeTruthy();
    const returnButton = screen.getByRole("button", { name: /^随同一艾文实际返程/ }) as HTMLButtonElement;
    expect(returnButton.disabled).toBe(false); await userEvent.click(returnButton);
    expect(screen.getByText(away.at)).toBeTruthy(); expect(screen.getByText("21")).toBeTruthy();
    rerender(<TravelerPanel traveler={{ ...value, insideCase: false, actions: [], ritual: { ...placed, at: "本人已回原指导室", escortSpirituality: 18 } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("本人已回原指导室")).toBeTruthy(); expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("第60周本人已实际放置", { exact: false })).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([place.command, back.command]);
  });

  it("offers the exact public return without placement, refunds or inferred guide-rest commands", async () => {
    const back = action({ type: "RITUAL_RETURN" }, "放弃本次放置并实际返程", true, "0行动 · 艾文3灵性");
    const value = traveler({ ritual: { ...ritual, at: "本人在回音深井", escortSpirituality: 3, history: ["此前往返费用与未放置记录保留。"] }, insideCase: true, actions: [back] });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^放弃本次放置并实际返程/ }));
    expect(screen.getByText("本人在回音深井")).toBeTruthy(); expect(screen.getAllByText("尚未亲自放置", { exact: false })).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /恢复护送者|退款|重新召唤|补满/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command);
  });

  it("preserves the four placed anchors and actual drift after a failed original bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("traveler-potion-1"));
    expect(screen.getByText(/服药将实际发生不可控灵界漫游/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶旅行家魔药」" }));
    const anchors = { ...ritual, escortSpirituality: 0, coordinates: ritual.coordinates.map((site) => ({ ...site, status: "第60周实际放置，原坐标保留" })), history: ["第62周首瓶失败，实际漫游后借四处原坐标辨认自我并返回；原瓶已消耗。"] };
    rerender(<TravelerPanel traveler={{ ...value, actions: value.actions.slice(1), ritual: anchors,
      bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用，原失败保留" } : bottle) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getAllByText("第60周实际放置，原坐标保留", { exact: false })).toHaveLength(4);
    expect(screen.getByText(anchors.history[0]!)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重新放置|跳过漫游/ })).toBeNull();
    await userEvent.click(bottleButton("traveler-potion-2"));
    expect(screen.getByText("traveler-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards only selected public methods without moving a body, taking a card or consenting optimistically", async () => {
    const commands: TravelerCommand[] = [{ type: "OBSERVE", caseId: "willing-companion" },
      { type: "PREPARE", caseId: "willing-companion", method: "ORDINARY" },
      { type: "PREPARE", caseId: "willing-companion", method: "ABILITY" },
      { type: "PERFORM", caseId: "willing-companion" }, { type: "WITHDRAW", caseId: "willing-companion" },
      { type: "CLOSE", caseId: "willing-companion" }, { type: "REPORT", caseId: "willing-companion" }];
    const labels = ["核对独立在场米拉", "准备普通两人同行", "准备有限携人旅行", "实际执行同行", "撤回本次同意", "实际走回并结束", "提交有限报告"];
    const value = traveler({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "known-landing");
    expect(screen.queryByRole("button", { name: /^实际执行同行/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "willing-companion");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const text of [originalPractice.position, originalPractice.card, originalPractice.companion]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "旅行家实际结果" })).toBeNull();
  });

  it("prioritizes the active actual CLOSE then WITHDRAW with zero resources, never a prose-inferred case", async () => {
    const { onCommand, rerender } = panel(traveler({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "offered-card");
    const value = opened();
    rerender(<TravelerPanel traveler={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("willing-companion"); expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("下一步：两人普通步行返回并结束");
    const close = screen.getByRole("button", { name: /^两人普通步行返回并结束/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性"); await userEvent.click(close);
    expect(screen.getByText(value.practice!.position)).toBeTruthy(); expect(screen.getByText(value.practice!.companion)).toBeTruthy();
    const onlyWithdraw = { ...value, actions: [action({ type: "CLOSE", caseId: "known-landing" }, "旧案不能结束", false), value.actions[2]!] };
    rerender(<TravelerPanel traveler={onlyWithdraw} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("下一步：撤回尚未实施的准备");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("willing-companion");
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未实施的准备/ }));
    expect(screen.getByText(failure)).toBeTruthy(); expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[1]!.command, value.actions[2]!.command]);
  });

  it("holds the original card until physical return is committed and retains the failed attempt", async () => {
    const close = action({ type: "CLOSE", caseId: "offered-card" }, "步行两米归还同一原卡再返回", true, "0行动 · 0灵性");
    const value = traveler({ promoted: true, insideCase: true, actions: [close], cases: cases().map((entry) => entry.id === "offered-card" ? { ...entry, observations: ["此前无形之手尝试失败，已耗2灵性。"], result: "之后本人普通步行实际取到同一原卡。" } : entry),
      practice: { ...originalPractice, card: "TR5-CARD-1在本人手中，仍属于导师", history: ["同一原卡实际取用1次，尚未归还。"] } });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^步行两米归还同一原卡再返回/ }));
    expect(screen.getByText(value.practice!.card)).toBeTruthy();
    rerender(<TravelerPanel traveler={{ ...value, insideCase: false, actions: [], practice: { ...originalPractice, history: ["已普通步行归还原卡并实际走回，共归还1次。"] } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(originalPractice.card)).toBeTruthy(); expect(screen.getByText("此前无形之手尝试失败，已耗2灵性。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /复制|隔墙|免费传送/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("forwards inherited real teacher recording and Belan encounter commands without hidden choices", async () => {
    const commands: TravelerCommand[] = [{ type: "RECORD_SAMPLE", sample: "FLASH" }, { type: "RECORD_SAMPLE", sample: "COURAGE" }, { type: "ENCOUNTER_TALK" }, { type: "ENCOUNTER_FIGHT" }];
    const labels = ["亲访诺拉实际记录闪光", "亲访萨芙实际记录鼓舞", "向贝兰交涉", "承担贝兰真实冲突"];
    const value = traveler({ promoted: true, actions: commands.map((command, index) => action(command, labels[index]!)), cases: cases(), practice: originalPractice });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(screen.getByRole("region", { name: "旅行家有限冲突" }).textContent).toContain("成年仓库守门人贝兰");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.queryByRole("button", { name: /任意乘客|隐秘空间|放逐|高位示范/ })).toBeNull();
  });

  it("renders only public fields and keeps historical prose from opening scenes or granting extra actions", async () => {
    const value = { ...opened(), insideCase: false, actions: [], ritual: null, practice: null };
    const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("known-landing"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "willing-companion"); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "本人原卡与同伴实际位置" })).toBeNull();
    expect(screen.queryByRole("region", { name: "四处特殊坐标与实际返程" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<TravelerPanel traveler={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks all real commands on busy, external blockers and save errors, retaining committed resources", () => {
    const unavailable = action({ type: "RECORD_SAMPLE", sample: "FLASH" }, "本周已实际尝试", false);
    const value = { ...opened(), actions: [...opened().actions, unavailable] }; const { onCommand, rerender } = panel(value);
    const disabled = screen.getByRole("button", { name: /^本周已实际尝试/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`traveler-reason-${unavailable.id}`);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<TravelerPanel traveler={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.position)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 100 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows peaceful completion and explicit S4 boundaries without inventing learned abilities", () => {
    const abilities = [{ id: "door.s5.travel", label: "旅行", mastery: 0, description: "本人真实定位移动。" },
      { id: "door.s5.invisible-hand", label: "无形之手", mastery: 8, description: "实际取用可见许可原卡。" },
      { id: "door.s6.recording", label: "原记录", mastery: 67, description: "原记录与原示范保留。" }];
    panel(traveler({ promoted: true, acting: 100, actions: [], abilities, practice: originalPractice, cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", closes: 1, result: "普通方法实际结束后报告。" })) }));
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "旅行家扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "旅行家成长下一步" }).textContent).toContain("这一阶段已消化");
    const boundary = screen.getByLabelText("旅行家能力边界");
    for (const text of ["隐秘空间、口袋空间或放逐", "新神性容量为4", "能力ID与掌握继续保留", "已核对的六米有限路径", "结束由两人普通步行返回"]) expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps every actual original demonstration, record, release, instructor resource and old case read-only", () => {
    const recorder: RecorderProjection = {
      title: "记录官", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "记录官原供货记录保留。", story: "旧三案已经和平收尾。", environment: "原教学室公开来源。",
      actions: [{ id: "old-record", label: "不可再次结算旧实践", enabled: true, reason: null, cost: "1行动", command: { type: "RECORD", sample: "FLASH" } }],
      cases: ["flash-screen", "courage-task", "missing-source"].map((id, index) => ({ id, title: `记录官原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原失败：鼓舞释放失败，原份已经耗尽。", "下一周本人普通核实，修订原印象。"] : [],
        preparation: index === 1 ? "当时已准备有限鼓舞和普通任务。" : null, result: `原案${index + 1}报告已提交，原失败与修订保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "recorder-potion-2", title: "记录官旧原瓶", source: "记录官原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "recorder-potion-2", confirmed: true } }],
      abilities: [{ id: "door.s6.recording", label: "原能力记录", mastery: 67, description: "原观察与核实条件继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      capacities: [{ tier: "LOW", label: "低阶原容量", used: 1, maximum: 20, boundary: "原低阶边界" }, { tier: "MID", label: "中阶原容量", used: 0, maximum: 8, boundary: "原中阶边界" }, { tier: "DIVINE", label: "神性记录容量", used: 0, maximum: 4, boundary: "新晋旅行家空容量4" }],
      records: [{ id: "recorder-record-1", sample: "FLASH", sequence: 8, status: "STORED", sourceDemoId: "recorder-demo-2", createdWeek: 42, releasedWeek: null, label: "原闪光", source: "诺拉原示范" },
        { id: "recorder-record-2", sample: "COURAGE", sequence: 9, status: "RELEASED", sourceDemoId: "recorder-demo-3", createdWeek: 43, releasedWeek: 44, label: "原鼓舞", source: "萨芙原示范" }],
      demonstrations: [{ id: "recorder-demo-1", sample: "FLASH", actor: "NORA", week: 41, revision: 120, success: false, label: "闪光", actorName: "诺拉·维恩" },
        { id: "recorder-demo-2", sample: "FLASH", actor: "NORA", week: 42, revision: 124, success: true, label: "闪光", actorName: "诺拉·维恩" }],
      samples: [{ id: "FLASH", label: "闪光", source: "序列8诺拉真实示范", instructorSpirituality: 14, lastAttemptWeek: 42, stored: 1 }],
    };
    render(<TravelerRecorderHistory recorder={recorder} />);
    const history = within(screen.getByRole("region", { name: "记录官时期的经历" }));
    for (const entry of recorder.cases) {
      expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
      expect(history.getByText(`当时的接触：已实际结束 · 实际结束次数：${entry.closes}`)).toBeTruthy();
      expect(history.getByText(`当时的实际结果与报告：${entry.result}`)).toBeTruthy();
    }
    expect(history.getByText("原失败：鼓舞释放失败，原份已经耗尽。")).toBeTruthy();
    expect(history.getByText("原示范ID：recorder-demo-1 · 第41周 · 版本120")).toBeTruthy();
    expect(history.getByText("原示范已亲见，本次记录失败；已耗行动与双方灵性保留，没有新增记录。")).toBeTruthy();
    expect(history.getByText("原记录ID：recorder-record-1")).toBeTruthy(); expect(history.getByText("原记录ID：recorder-record-2")).toBeTruthy();
    expect(history.getByText("原鼓舞 · 序列 9 · 已释放，原记录已消耗")).toBeTruthy();
    expect(history.getByText("原示范ID：recorder-demo-3 · 第43周实际记录 · 第44周实际释放")).toBeTruthy();
    expect(history.getByText("示范者当前灵性 14 · 已储存 1 份 · 最近尝试：第42周")).toBeTruthy();
    expect(history.getByText("0 / 4", { exact: false })).toBeTruthy(); expect(history.getByText("1 / 20", { exact: false })).toBeTruthy();
    expect(history.getByText("0 / 8", { exact: false })).toBeTruthy();
    expect(history.getByText("原瓶ID：recorder-potion-2")).toBeTruthy();
    expect(history.getByText("原能力记录 · 掌握 67：原观察与核实条件继续保留。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
