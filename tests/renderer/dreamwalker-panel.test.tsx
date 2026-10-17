/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DreamwalkerAction, DreamwalkerCommand, DreamwalkerProjection } from "../../src/domain/dreamwalker/types";
import type { HypnotistProjection } from "../../src/domain/hypnotist/types";
import { DREAMWALKER_CONSUMPTION_RISK, DREAMWALKER_SOURCE_STATUS } from "../../src/domain/dreamwalker/content";
import { DreamwalkerHypnotistHistory, DreamwalkerPanel } from "../../src/renderer/DreamwalkerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 100,
  cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: DreamwalkerCommand, label: string, enabled = true, cost = "本次公开成本"): DreamwalkerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件未满足。", command };
}
function projection(patch: Partial<DreamwalkerProjection> = {}): DreamwalkerProjection {
  return {
    title: "梦境行者之路", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "三瓶独立G成品原瓶尚在原渠道。", story: DREAMWALKER_SOURCE_STATUS, actions: [], bottles: [], abilities: [],
    acting: 0, digestion: "催眠师扮演100，晋升后12/12整周。", pollution: 3, risk: DREAMWALKER_CONSUMPTION_RISK,
    cases: [], practice: null, insideCase: false, environment: "尚未开始梦境实践。",
    ritual: { title: "鸟妖契约与原尾羽", status: "尚无实际会面", participant: "铃尾尚未到场",
      contract: "尚未与铃尾签订契约", feather: "唯一原尾羽DW5-FEATHER仍由铃尾持有", emotion: "尚未准备本次激烈情绪",
      appointment: "尚未预约", visits: [] },
    ...patch,
  };
}
function cases(): DreamwalkerProjection["cases"] {
  return [
    { id: "dream-evidence", title: "梦话与原记录", story: "成年自愿对象的梦话须回到现实独立核实。" },
    { id: "repeated-garden", title: "跨周自愿意象", story: "本人同意局部梦境修改，须跨真实周再次自愿练习与清醒核验。" },
    { id: "paired-dream", title: "两间房与两个实际梦", story: "两名成人同意，两个实际梦与160米固定房间之间进行有限身体移动。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始接触", closes: 0, sessions: 0, sessionWeeks: [], verified: false }));
}
function bottled(): DreamwalkerProjection {
  const value = projection();
  const bottles = [
    { id: "dreamwalker-potion-1", title: "第一瓶梦境行者魔药", source: "原渠道第一瓶，独立封签与五步劳务记录", chance: 71 },
    { id: "dreamwalker-potion-2", title: "第二瓶梦境行者魔药", source: "原渠道第二瓶，独立采购记录", chance: 43 },
    { id: "dreamwalker-potion-3", title: "第三瓶梦境行者魔药", source: "原渠道第三瓶，独立交付记录", chance: 61 },
  ];
  return { ...value, guidanceKnown: true,
    actions: bottles.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗这一原瓶")),
    bottles: bottles.map((bottle): DreamwalkerProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
    ritual: { ...value.ritual, status: "第53周原会所专室的真实会面", participant: "铃尾实际在场，承担外力唤醒",
      contract: "第52周接受的同一有效契约", feather: "玩家暂持唯一原尾羽DW5-FEATHER", emotion: "本次真实喜悦回忆激起激烈情绪",
      appointment: "第52周预约，第53周实际赴会", visits: [{ id: 1, summary: "本次尚未服药，原尾羽尚未归还。" }] },
  };
}
function panel(value: DreamwalkerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
function nextText(): string { return screen.getByRole("region", { name: "梦境行者成长下一步" }).textContent ?? ""; }
afterEach(cleanup);

describe("Dreamwalker public ritual, original bottles, real exits and retained history", () => {
  it("keeps the full formula unknown while showing the verified ritual source and actual unstarted state", () => {
    const value = projection({ formula: [{ name: "未经核实不得显示的材料", quantity: 10, unit: "克" }] });
    const { onCommand } = panel(value);
    expect(nextText()).toContain("催眠师6 → 梦境行者5");
    expect(nextText()).toContain("完整魔药配方尚未核实");
    expect(nextText()).toContain("鸟妖契约、原尾羽、激烈情绪和外力唤醒仪式");
    expect(screen.getByText(DREAMWALKER_SOURCE_STATUS)).toBeTruthy();
    expect(screen.getByText("尚未与铃尾签订契约")).toBeTruthy();
    expect(screen.getByText("唯一原尾羽DW5-FEATHER仍由铃尾持有")).toBeTruthy();
    expect(screen.queryByText("未经核实不得显示的材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /配方|调配|召唤|服用|赴会/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards guidance, original-bottle labour, payment and resupply commands and costs unchanged", async () => {
    const commands: DreamwalkerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "dreamwalker-potion-2" },
      { type: "BUY_POTION", bottleId: "dreamwalker-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "核对第二瓶原封签", "支付第二瓶余款", "请求下一批", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5", "600便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(projection({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.getByText("三瓶独立G成品原瓶尚在原渠道。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("waits for real later-week appointment eligibility instead of creating an instant ritual", async () => {
    const request = action({ type: "REQUEST_RITUAL" }, "预约铃尾的实际会面", true, "1行动 · 最早下一真实周");
    const value = projection({ actions: [request] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^预约铃尾/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(request.command);
    expect(screen.getByText("尚未预约")).toBeTruthy();
    const begin = { ...action({ type: "BEGIN_RITUAL" }, "按预约实际赴会", false, "1行动 · 120便士"), reason: "第52周预约，须等待下一真实周。" };
    const waiting = { ...value, actions: [begin], ritual: { ...value.ritual, appointment: "第52周已预约，最早第53周到访" } };
    rerender(<DreamwalkerPanel dreamwalker={waiting} resources={resources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^按预约实际赴会/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.getByText("铃尾尚未到场")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /WAIT|直接过周|跳过/ })).toBeNull();
    rerender(<DreamwalkerPanel dreamwalker={{ ...waiting, actions: [{ ...begin, enabled: true, reason: null }] }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^按预约实际赴会/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([request.command, begin.command]);
  });

  it("shows the same contract, original feather, emotion and actual visit history exactly as projected", () => {
    const value = bottled(); value.ritual.visits.push({ id: 2, summary: "下一真实周再赴会；第一瓶失败已唤醒，原尾羽曾实际归还。" });
    const { onCommand } = panel(value);
    const ritual = within(screen.getByRole("region", { name: "梦境行者真实仪式" }));
    for (const text of [value.ritual.status, value.ritual.participant, value.ritual.contract, value.ritual.feather, value.ritual.emotion, value.ritual.appointment]) {
      expect(ritual.getByText(text)).toBeTruthy();
    }
    expect(ritual.getByText("第2次会面：下一真实周再赴会；第一瓶失败已唤醒，原尾羽曾实际归还。")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("cancels every original independently at zero AP and restores keyboard focus without spending", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["dreamwalker-potion-1", "dreamwalker-potion-2", "dreamwalker-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3"); expect(screen.getByText(id)).toBeTruthy();
      if (id === "dreamwalker-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows original source, four-tier cost, live ritual and current resources before one exact confirmation", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("dreamwalker-potion-2"));
    expect(screen.getByText("dreamwalker-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "梦境行者服用风险与四档结果" }).textContent).toContain(DREAMWALKER_CONSUMPTION_RISK);
    expect(screen.getByRole("region", { name: "服药前的真实仪式状态" }).textContent).toContain(value.ritual.feather);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶梦境行者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "梦境行者能力与消化" })).toBeNull();
  });

  it("distinguishes identically named original bottles by their IDs and confirms only the selected original", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立成品原瓶" }));
    const { onCommand } = panel(value); await userEvent.click(bottleButton("dreamwalker-potion-3"));
    expect(screen.getByText("dreamwalker-potion-3")).toBeTruthy();
    expect(screen.queryByText("dreamwalker-potion-1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「独立成品原瓶」" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[2]!.command);
  });

  it("retains the original submitted operation during save failure and reserves retry for the outer envelope owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dreamwalker-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶梦境行者魔药」" }));
    const error = { message: "本次服药保存失败，请重试原操作。", retryable: true };
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶梦境行者魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("dreamwalker-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶梦境行者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows committed failure, keeps ending the real meeting available and separately confirms a later original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dreamwalker-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶梦境行者魔药」" }));
    const end = action({ type: "END_RITUAL" }, "结束会面并归还同一原尾羽", true, "0行动 · 0精神 · 0灵性");
    const failed = { ...value, actions: [end], bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "第一瓶已耗用，原排异保留，铃尾实际唤醒。" } : bottle) };
    rerender(<DreamwalkerPanel dreamwalker={failed} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("第一瓶已耗用，原排异保留，铃尾实际唤醒。")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "这瓶梦境行者魔药的服用确认" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^结束会面并归还/ }));
    const later = { ...failed, actions: [value.actions[1]!], ritual: { ...value.ritual, appointment: "第二次预约后，下一真实周已实际到场" } };
    rerender(<DreamwalkerPanel dreamwalker={later} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(bottleButton("dreamwalker-potion-2"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶梦境行者魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, end.command, value.actions[1]!.command]);
  });

  it("dismisses revoked public consumption and shows promotion only after a committed projection", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dreamwalker-potion-2"));
    rerender(<DreamwalkerPanel dreamwalker={{ ...value, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶梦境行者魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("region", { name: "梦境行者能力与消化" })).toBeNull();
    rerender(<DreamwalkerPanel dreamwalker={{ ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "原瓶记录保留" })) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "梦境行者能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶ID：dreamwalker-potion-2")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses current public eligibility and chance rather than recomputing attribute gates", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dreamwalker-potion-2"));
    const reason = "原契约当前不适用，请按公开状态重新核对。";
    const updated = { ...value, risk: "更新后的公开四档风险", bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<DreamwalkerPanel dreamwalker={updated} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶梦境行者魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    rerender(<DreamwalkerPanel dreamwalker={{ ...updated, actions: value.actions }} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第二瓶梦境行者魔药」" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps published 0-resource END_RITUAL, CLOSE, RETURN and WITHDRAW available inside a practice", async () => {
    const commands: DreamwalkerCommand[] = [{ type: "END_RITUAL" }, { type: "CLOSE", caseId: "paired-dream" }, { type: "RETURN" }, { type: "WITHDRAW", caseId: "paired-dream" }];
    const labels = ["实际结束会面", "退出当前梦境", "沿原普通路归源", "撤回未实施准备"];
    const value = projection({ promoted: true, insideCase: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!, true, "0行动 · 0精神 · 0灵性")) });
    const onCommand = vi.fn(); render(<DreamwalkerPanel dreamwalker={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("paired-dream");
  });

  it("prioritizes genuine exits and actual return in the next-step summary", () => {
    const exits = [action({ type: "END_RITUAL" }, "先结束真实会面"), action({ type: "CLOSE", caseId: "paired-dream" }, "先退出当前梦境"),
      action({ type: "RETURN" }, "先沿原普通路归源"), action({ type: "WITHDRAW", caseId: "paired-dream" }, "先撤回本次准备")];
    const perform = action({ type: "PERFORM", caseId: "paired-dream" }, "执行另一操作");
    const value = projection({ promoted: true, cases: cases(), actions: [perform, ...exits] }); const { onCommand, rerender } = panel(value);
    exits.forEach((exit, index) => {
      rerender(<DreamwalkerPanel dreamwalker={{ ...value, actions: [perform, ...exits.slice(index)] }} resources={resources} busy={false} onCommand={onCommand} />);
      expect(nextText()).toContain(`下一步：${exit.label}`);
    });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects a case and forwards observation, both methods, execution, verification and reporting unchanged", async () => {
    const commands: DreamwalkerCommand[] = [{ type: "OBSERVE", caseId: "dream-evidence" }, { type: "PREPARE", caseId: "dream-evidence", method: "ORDINARY" },
      { type: "PREPARE", caseId: "dream-evidence", method: "ABILITY" }, { type: "PERFORM", caseId: "dream-evidence" },
      { type: "VERIFY", caseId: "dream-evidence" }, { type: "REPORT", caseId: "dream-evidence" }];
    const labels = ["核对意愿与现场", "准备普通核查", "准备梦境引导", "实际执行本次方法", "回到现实独立核验", "提交有限报告"];
    const { onCommand } = panel(projection({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "paired-dream");
    expect(screen.queryByRole("button", { name: /^准备梦境引导/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "dream-evidence");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.queryByRole("region", { name: "梦境行者实际结果" })).toBeNull();
  });

  it("does not create consent or dream-entry commands for an unwilling or awake participant", () => {
    const entries = cases().filter((entry) => entry.id === "dream-evidence").map((entry) => ({ ...entry,
      observations: ["本人今天拒绝梦境实践，仍清醒。", "梦中说法尚无现实凭据。"] }));
    const { onCommand } = panel(projection({ promoted: true, cases: entries }));
    expect(screen.getByText("本人今天拒绝梦境实践，仍清醒。")).toBeTruthy();
    expect(screen.getByText("梦中说法尚无现实凭据。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /同意|入梦|引导|修改|穿梭|核验/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps real execution visible while inside rather than locking every action except close", async () => {
    const perform = action({ type: "PERFORM", caseId: "paired-dream" }, "从真实源梦穿梭至真实目标梦");
    const close = action({ type: "CLOSE", caseId: "paired-dream" }, "实际退出当前梦境");
    const value = projection({ promoted: true, insideCase: true, cases: cases(), actions: [perform, close] });
    const { onCommand } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("paired-dream"); expect(selector.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^从真实源梦/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.getByRole("button", { name: /^实际退出/ })).toBeTruthy();
  });

  it("preserves actual body movement and waits for saved CLOSE and RETURN projections", async () => {
    const close = action({ type: "CLOSE", caseId: "paired-dream" }, "在目标节点退出当前梦境", true, "0行动");
    const back = action({ type: "RETURN" }, "沿160米原普通路回到源房间", true, "0行动");
    const value = projection({ promoted: true, insideCase: true, cases: cases(), actions: [close], practice: { location: "TARGET_ROOM", dream: "AMINA", outboundTrips: 1, returns: 0, wakingChecks: 0 }, environment: "身体已真实抵达160米外目标房间，当前位于阿米娜的实际梦境。" });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^在目标节点退出/ }));
    expect(screen.getByText(value.environment)).toBeTruthy();
    const body = within(screen.getByRole("region", { name: "实际身体节点与梦境状态" }));
    expect(body.getByText("160米外的目标房间")).toBeTruthy(); expect(body.getByText("阿米娜的实际梦境")).toBeTruthy();
    const closed: DreamwalkerProjection = { ...value, actions: [back], practice: { ...value.practice!, dream: "NONE" }, environment: "已实际退出梦境，身体仍在目标房间，未自动回到源头。" };
    rerender(<DreamwalkerPanel dreamwalker={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(closed.environment)).toBeTruthy(); expect(nextText()).toContain(back.label);
    expect(screen.getByText("160米外的目标房间")).toBeTruthy(); expect(screen.getByText("当前没有梦境接触")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^沿160米原普通路/ }));
    expect(screen.getByText(closed.environment)).toBeTruthy();
    rerender(<DreamwalkerPanel dreamwalker={{ ...closed, insideCase: false, actions: [], practice: { ...closed.practice!, location: "SOURCE_ROOM", returns: 1 }, environment: "身体已沿原普通路线回到源房间，两梦接触均结束。" }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("身体已沿原普通路线回到源房间，两梦接触均结束。")).toBeTruthy(); expect(screen.getByText("源房间")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([close.command, back.command]);
  });

  it("retains cross-week voluntary imagery records without fabricating a second visit or reality check", async () => {
    const observe = action({ type: "OBSERVE", caseId: "repeated-garden" }, "下周重新确认本人意愿");
    const value = projection({ promoted: true, cases: cases().filter((entry) => entry.id === "repeated-garden").map((entry) => ({ ...entry,
      sessions: 1, sessionWeeks: [54], verified: false, observations: ["第54周第一次本人自愿意象练习，已实际退出。"], result: "只有一次实际练习，尚未完成跨周复访或现实核验。" })), actions: [observe] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^下周重新确认/ }));
    expect(screen.getByText("只有一次实际练习，尚未完成跨周复访或现实核验。")).toBeTruthy();
    const updated = { ...value, cases: value.cases.map((entry) => ({ ...entry, sessions: 2, sessionWeeks: [54, 55], observations: [...entry.observations, "第55周本人再次自愿，第二次局部意象已结束。"], result: "两次跨周实践已保存，清醒后的有限反馈仍须独立核验。" })) };
    rerender(<DreamwalkerPanel dreamwalker={updated} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("第54周第一次本人自愿意象练习，已实际退出。")).toBeTruthy();
    expect(screen.getByText("第55周本人再次自愿，第二次局部意象已结束。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际练习与跨周核验记录" }).textContent).toContain("已实际练习 2 次 · 练习周：第54周、第55周");
    expect(screen.getByText("本案尚未完成清醒现实核验")).toBeTruthy();
    expect(screen.getByRole("region", { name: "梦境行者实际结果" }).textContent).toContain("清醒后的有限反馈仍须独立核验");
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(observe.command);
  });

  it("renders old Hypnotist original IDs, consent, failure, closes and ability mastery as read-only history", () => {
    const value: HypnotistProjection = {
      title: "催眠师之路", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原催眠师供给记录", story: "原催眠师故事", environment: "原后门现场", acting: 100, digestion: "原催眠师已消化", pollution: 4, risk: "旧服用风险", insideCase: false,
      actions: [{ id: "old-perform", label: "不得再次执行旧练习", cost: "旧成本", enabled: true, reason: null, command: { type: "PERFORM", caseId: "protected-choice" } }],
      cases: [{ id: "protected-choice", title: "旧选择边界", story: "旧场景本人先拒绝后重新同意有限练习。", status: "RESOLVED",
        observations: ["原拒绝保留", "原失败与已付灵性保留"], preparation: "原修订后的有限准备", result: "原报告：没有强迫本人改变底线", contactOpen: "原接触已实际结束", closes: 2 }],
      bottles: [{ id: "hypnotist-potion-2", title: "同名旧原瓶", source: "旧独立成品来源", status: "原瓶已耗用且失败", chance: 40, command: { type: "CONSUME", bottleId: "hypnotist-potion-2", confirmed: true } }],
      abilities: [{ id: "audience.s6.hypnosis", label: "催眠", mastery: 173, description: "原ID与掌握保留" }],
    };
    render(<DreamwalkerHypnotistHistory hypnotist={value} />);
    const history = screen.getByRole("region", { name: "催眠师时期的经历" });
    for (const text of ["protected-choice", "hypnotist-potion-2", "原拒绝保留", "原失败与已付灵性保留", "实际结束次数：2", "掌握 173", "旧独立成品来源"]) expect(history.textContent).toContain(text);
    expect(screen.queryByRole("button", { hidden: true })).toBeNull();
    expect(screen.queryByRole("combobox", { hidden: true })).toBeNull();
  });

  it("blocks interaction for busy, blocked and save-error states without inventing outcomes or local retries", () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "有限交涉");
    const value = projection({ promoted: true, actions: [talk] }); const { onCommand, rerender } = panel(value);
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={true} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^有限交涉/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("正在结算并保存");
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^有限交涉/ }));
    rerender(<DreamwalkerPanel dreamwalker={value} resources={resources} busy={false} error={{ message: "原保存版本不匹配", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(screen.getByRole("button", { name: /^有限交涉/ }));
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
});
