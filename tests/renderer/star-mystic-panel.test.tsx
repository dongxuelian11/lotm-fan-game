/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StarMysticAction, StarMysticCommand, StarMysticProjection } from "../../src/domain/star-mystic/types";
import type { ScrollProfessorProjection } from "../../src/domain/scroll-professor/types";
import { StarMysticPanel, StarMysticScrollProfessorHistory } from "../../src/renderer/StarMysticPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；卷轴教授消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: StarMysticCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): StarMysticAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取星象师成品用药指导", true, "460便士 · 1行动");
function mystic(patch: Partial<StarMysticProjection> = {}): StarMysticProjection {
  return {
    title: "星象师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "卷轴教授扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, ...patch,
  };
}
function cases(): StarMysticProjection["cases"] {
  return [
    { id: "veiled-marker", title: "遮帘后的约定标记", story: "原指导者伊蕾在六米外的同一原薄帘后，双方已约定只核对此次标记。" },
    { id: "willing-cage", title: "自愿同伴的有限星光囚笼", story: "成年达芙宁在两米外原等候点，只同意有限练习，随时可以停止。" },
    { id: "uncertain-chart", title: "矛盾旧记录与当下天空", story: "三条G旧天气记录互相冲突，原普通走廊通向六米外庭院。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalPractice: NonNullable<StarMysticProjection["practice"]> = {
  vision: "同一原厚眼镜SM5-LENS-1仍由伊蕾保管，原帘关闭，尚未实际看见约定标记。",
  cage: "达芙宁仍在两米外原等候点，尚未建立星光囚笼。",
  position: "本人仍在原房间，尚未沿普通走廊核对当下天空。",
  history: [],
};
function bottled(): StarMysticProjection {
  const originals = [
    { id: "star-mystic-potion-1", title: "第一瓶星象师魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "star-mystic-potion-2", title: "第二瓶星象师魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "star-mystic-potion-3", title: "第三瓶星象师魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return mystic({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): StarMysticProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function workshop(): NonNullable<StarMysticProjection["workshop"]> {
  return {
    summary: "同一原工坊已购2包，原序列6失败与耗用记录保留，新序列5实际制卷一次。",
    lessons: [{ id: "light-touch", label: "有限牵引", learned: true, description: "原巫师真实学会的有限牵引。" },
      { id: "brief-ward", label: "短时护持", learned: false, description: "仍需实际学习原课程。" }],
    materials: [{ id: "SP6-material-1", acquiredWeek: 40, status: "SPENT", spentWeek: 41 },
      { id: "SP6-material-5", acquiredWeek: 60, status: "SPENT", spentWeek: 61 },
      { id: "SP6-material-6", acquiredWeek: 60, status: "HELD", spentWeek: null }],
    scrolls: [{ id: "SP6-scroll-1", kind: "IMPACT", title: "原序列6冲力卷", source: "第41周实际原刻录", materialId: "SP6-material-1",
      makerSequence: 6, inscriptionMastery: 12, createdWeek: 41, status: "USED", usedWeek: 49, authorized: false },
      { id: "SP6-scroll-5", kind: "IMPACT", title: "晋升后实际冲力原卷", source: "第61周使用同一工坊实际新刻录", materialId: "SP6-material-5",
        makerSequence: 5, inscriptionMastery: 37, createdWeek: 61, status: "HELD", usedWeek: null, authorized: false }],
  };
}
function panel(value: StarMysticProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<StarMysticPanel starMystic={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Star mystic public sight, original glasses, inherited workshop and bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "卷轴教授扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(mystic({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "星象师成长下一步" });
    expect(summary.textContent).toContain("卷轴教授6 → 星象师5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式细节尚未掌握；材料、剂量、调配顺序及具体仪式要求保持未知，服药前仍须完成准备。本阶段采用独立成品渠道、导师准备与指导服药流程，不提供材料表。");
    expect(summary.textContent).toContain("服药前仍须完成准备");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取星象师成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: StarMysticCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "star-mystic-potion-3" },
      { type: "BUY_POTION", bottleId: "star-mystic-potion-3" }, { type: "BUY_POTION", bottleId: "star-mystic-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(mystic({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["star-mystic-potion-1", "star-mystic-potion-2", "star-mystic-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "star-mystic-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-2"));
    expect(screen.getByText("star-mystic-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "星象师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶星象师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "星象师能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶星象师魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<StarMysticPanel starMystic={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶星象师魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("star-mystic-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<StarMysticPanel starMystic={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<StarMysticPanel starMystic={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶星象师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶星象师魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶星象师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<StarMysticPanel starMystic={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*star-mystic-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("star-mystic-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("star-mystic-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶星象师魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶星象师魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升星象师" } : bottle) };
    rerender(<StarMysticPanel starMystic={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶星象师魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "星象师能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升星象师")).toBeTruthy();
    expect(screen.getByText("原瓶ID：star-mystic-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-2"));
    expect(screen.getByText("star-mystic-potion-2")).toBeTruthy();
    rerender(<StarMysticPanel starMystic={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶星象师魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("star-mystic-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<StarMysticPanel starMystic={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶星象师魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });


  it("forwards the actual lens purchase and never creates or wears glasses before saved success", async () => {
    const buy = action({ type: "BUY_LENSES" }, "向伊蕾购买并实际戴好同一厚眼镜", true, "1行动 · 80便士 · 原件SM5-LENS-1");
    const value = mystic({ promoted: true, cases: cases(), practice: originalPractice, actions: [buy] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^向伊蕾购买并实际戴好/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command);
    expect(onCommand.mock.calls[0]![0]).toBe(buy.command);
    expect(screen.getByText(originalPractice.vision)).toBeTruthy();
    const owned = "已实际支付80便士，原厚眼镜SM5-LENS-1已戴好；原帘仍关闭，尚未知约定标记内容。";
    rerender(<StarMysticPanel starMystic={{ ...value, actions: [], practice: { ...originalPractice, vision: owned } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(owned)).toBeTruthy(); expect(screen.queryByRole("button", { name: /购买.*厚眼镜/ })).toBeNull();
    expect(screen.queryByText(/三道横刻/)).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards the projected case methods unchanged without optimistically seeing, binding or walking", async () => {
    const commands: StarMysticCommand[] = [{ type: "OBSERVE", caseId: "veiled-marker" },
      { type: "PREPARE", caseId: "veiled-marker", method: "ORDINARY" }, { type: "PREPARE", caseId: "veiled-marker", method: "ABILITY" },
      { type: "PERFORM", caseId: "veiled-marker" }, { type: "WITHDRAW", caseId: "veiled-marker" },
      { type: "CLOSE", caseId: "veiled-marker" }, { type: "REPORT", caseId: "veiled-marker" }];
    const labels = ["核对原帘外边界", "准备普通拉帘", "准备有限窥秘", "实际观察", "撤回尚未执行的准备", "收束此次观察", "报告实际观察"];
    const value = mystic({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "veiled-marker");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const text of [originalPractice.vision, originalPractice.cage, originalPractice.position]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(/三道横刻/)).toBeNull(); expect(screen.queryByRole("region", { name: "星象师实际结果" })).toBeNull();
  });

  it("keeps prepared practice outside contact and recommends actual performance before withdrawal", () => {
    const perform = action({ type: "PERFORM", caseId: "willing-cage" }, "让达芙宁实际走到原标记并尝试囚笼", true, "1行动 · 3灵性 · 知识14");
    const withdraw = action({ type: "WITHDRAW", caseId: "willing-cage" }, "撤回待执行准备", true, "0行动 · 0精神 · 0灵性");
    panel(mystic({ promoted: true, practice: originalPractice, actions: [withdraw, perform],
      cases: cases().map((entry) => entry.id === "willing-cage" ? { ...entry, status: "PREPARED", preparation: "仅记录同意与方法，达芙宁未离开等候点。" } : entry) }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "星象师成长下一步" }).textContent).toContain(`下一步：${perform.label}`);
    expect(screen.getByText(originalPractice.cage)).toBeTruthy();
  });

  it("does not reveal the marker before actual saved observation and retains acquired knowledge after closing", async () => {
    const close = action({ type: "CLOSE", caseId: "veiled-marker" }, "拉合原帘并戴回原眼镜", true, "0行动 · 0精神 · 0灵性");
    const failed = "已实际抬起同一原眼镜，视野混乱；消耗3灵性与2精神，未核对成功。";
    const value = mystic({ promoted: true, insideCase: true, actions: [close],
      practice: { ...originalPractice, vision: "原眼镜在手中，原帘关闭，约定标记内容仍未知。", history: [failed] },
      cases: cases().map((entry) => entry.id === "veiled-marker" ? { ...entry, status: "EXAMINED", result: failed } : entry) });
    const { container, onCommand, rerender } = panel(value);
    expect(container.textContent).not.toMatch(/三道横刻|三条横刻|左手|右手/);
    const observed = "本次实际观察后已知：原木牌SM5-MARKER-1上有三道横刻；此知识来自已发生的观察。";
    const seen = { ...value, practice: { ...value.practice!, vision: observed } };
    rerender(<StarMysticPanel starMystic={seen} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(observed)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^拉合原帘并戴回原眼镜/ }));
    expect(screen.getByText(observed)).toBeTruthy();
    const closed = { ...seen, insideCase: false, actions: [], practice: { ...seen.practice!, vision: `${observed} 原帘已拉合，已戴回同一眼镜。` } };
    rerender(<StarMysticPanel starMystic={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(closed.practice.vision)).toBeTruthy();
    expect(screen.getAllByText(failed)).toHaveLength(2);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it.each(["veiled-marker", "willing-cage", "uncertain-chart"])("keeps the actual %s zero-resource exit usable and hides competing workshop or encounter actions", async (caseId) => {
    const close = action({ type: "CLOSE", caseId }, "实际结束并沿原路收束", true, "0行动 · 0精神 · 0灵性");
    const stale = action({ type: "CLOSE", caseId: caseId === "veiled-marker" ? "uncertain-chart" : "veiled-marker" }, "旧接触不可再关", false);
    const value = mystic({ promoted: true, insideCase: true, practice: originalPractice, cases: cases(), workshop: workshop(),
      actions: [stale, close, action({ type: "BUY_LENSES" }, "不可离场买眼镜"), action({ type: "BUY_KIT" }, "不可离场买材料"),
        action({ type: "CRAFT_SCROLL", kind: "IMPACT" }, "不可现场制卷"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前冲突"), action({ type: "REFLECT" }, "不可提前反思")] });
    const onCommand = vi.fn();
    render(<StarMysticPanel starMystic={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const button = screen.getByRole("button", { name: /^实际结束并沿原路收束/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); expect(button.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
    expect(selector.disabled).toBe(true); expect(screen.getByText(originalPractice.cage)).toBeTruthy();
  });

  it("retains the actual cage and participant until committed CLOSE, then shows her actual walked return", async () => {
    const close = action({ type: "CLOSE", caseId: "willing-cage" }, "解除囚笼让达芙宁沿原路走回", true, "0行动 · 0精神 · 0灵性");
    const cage = "达芙宁实际走到原标记，星光囚笼已经成功建立；当前不能移动，未受伤。";
    const value = mystic({ promoted: true, insideCase: true, cases: cases(), actions: [close], practice: { ...originalPractice, cage } });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^解除囚笼让达芙宁沿原路走回/ }));
    expect(screen.getByText(cage)).toBeTruthy();
    const returned = "本次囚笼已实际解除，达芙宁自由沿原两米路走回原等候点，未被传送，未受伤。";
    rerender(<StarMysticPanel starMystic={{ ...value, insideCase: false, actions: [], practice: { ...originalPractice, cage: returned, history: [cage, returned] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getAllByText(returned)).toHaveLength(2); expect(screen.getByText(cage)).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("renders only ordinary current-weather commands and preserves actual observation even when the report fails", async () => {
    const prepare = action({ type: "PREPARE", caseId: "uncertain-chart", method: "ORDINARY" }, "准备普通庭院核对", true, "1行动 · 0灵性");
    const value = mystic({ promoted: true, practice: originalPractice, cases: cases(), actions: [prepare] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通庭院核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command);
    expect(screen.queryByRole("button", { name: /能力|占卜未来|控制天气/ })).toBeNull();
    const current = "本人已实际走过原六米走廊到庭院，亲眼看到现在阴天；报告未通过，不能据此预测未来。";
    const close = action({ type: "CLOSE", caseId: "uncertain-chart" }, "沿原六米走廊实际返回", true, "0行动 · 0精神 · 0灵性");
    rerender(<StarMysticPanel starMystic={{ ...value, insideCase: true, actions: [close], practice: { ...originalPractice, position: current } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(current)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^沿原六米走廊实际返回/ }));
    expect(screen.getByText(current)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, close.command]);
  });

  it("never infers contact or marker contents from hidden-shaped extras, historical prose or a missing public practice", () => {
    const value = { ...mystic({ promoted: true, cases: cases(), actions: [], practice: null }),
      markerContents: "SECRET_MARKER_NOTCHES", privateHandPosition: "SECRET_HAND", nextRoll: "SECRET_ROLL", spellPool: ["SECRET_FREE_SPELL"] };
    const { container, onCommand, rerender } = panel(value);
    for (const secret of [value.markerContents, value.privateHandPosition, value.nextRoll, value.spellPool[0]!]) expect(container.textContent).not.toContain(secret);
    expect(screen.queryByRole("region", { name: "已保存的星象师视野与实际位置" })).toBeNull();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    rerender(<StarMysticPanel starMystic={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "星象师成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("continues the same inherited lesson, kit and selected craft commands without gifting skills, material or scrolls", async () => {
    const commands: StarMysticCommand[] = [{ type: "LEARN_SPELL", spellId: "brief-ward" }, { type: "BUY_KIT" },
      { type: "CRAFT_SCROLL", kind: "IMPACT" }, { type: "CRAFT_SCROLL", kind: "WARD" }];
    const labels = ["补学原短时护持", "购买四份原G材料", "以原冲力模板实际刻录", "以原护持模板实际刻录"];
    const costs = ["1行动 · 原巫师课程", "1行动 · 100便士 · 每周一次", "1行动 · 2灵性 · 1份材料 · 知识14", "1行动 · 2灵性 · 1份材料 · 知识14"];
    const actions = commands.map((command, index) => action(command, labels[index]!, true, costs[index]!));
    const saved = { ...workshop(), scrolls: [], materials: [] };
    const { onCommand } = panel(mystic({ promoted: true, workshop: saved, actions: [action({ type: "LEARN_SPELL", spellId: "light-touch" }, "不可重复已学课程"), ...actions] }));
    expect(screen.queryByRole("button", { name: /不可重复已学课程/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^补学原短时护持/ }));
    await userEvent.click(screen.getByRole("button", { name: /^购买四份原G材料/ }));
    const group = within(screen.getByRole("group", { name: "材料购买与卷轴刻录" }));
    for (const entry of actions.slice(2)) {
      await userEvent.selectOptions(group.getByRole("combobox"), entry.id);
      await userEvent.click(group.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByText("短时护持 · 尚未学会")).toBeTruthy();
    expect(screen.getByText("尚无刻录成功的卷轴原件。准备与失败不会生成成品。")).toBeTruthy();
    expect(screen.getByText("尚无实际购买的材料原份。")).toBeTruthy();
  });

  it("shows actual original maker6 and new maker5, frozen mastery, material costs and one-use history", () => {
    const saved = workshop(); panel(mystic({ promoted: true, workshop: saved, actions: [] }));
    expect(screen.getByText("制作周：41 · 制作者序列：6 · 刻录时掌握：12")).toBeTruthy();
    expect(screen.getByText("制作周：61 · 制作者序列：5 · 刻录时掌握：37")).toBeTruthy();
    for (const scroll of saved.scrolls) {
      expect(screen.getByText(scroll.title)).toBeTruthy(); expect(screen.getByText(`来源：${scroll.source}`)).toBeTruthy();
      expect(screen.getByText(new RegExp(`原卷轴ID：${scroll.id}`))).toBeTruthy();
    }
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    expect(screen.getByText("已耗用 · 剩余使用0次 · 未授权自动使用")).toBeTruthy();
    expect(screen.getByText("耗用周：49")).toBeTruthy();
    expect(screen.getByText(/材料ID：SP6-material-6 · 实际持有/)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards exact original authorization and revocation only after the user chooses, with no optimistic change", async () => {
    const saved = workshop(); const allow = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-5", authorized: true }, "授权这一序列5原卷供战斗使用", true, "0行动 · 匹配时使用一次");
    const value = mystic({ promoted: true, workshop: saved, actions: [allow] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^授权这一序列5原卷供战斗使用/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(allow.command);
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    const revoke = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-5", authorized: false }, "撤销这一原卷战前授权");
    rerender(<StarMysticPanel starMystic={{ ...value, actions: [revoke], workshop: { ...saved, scrolls: saved.scrolls.map((scroll) => scroll.id === "SP6-scroll-5" ? { ...scroll, authorized: true } : scroll) } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("实际持有 · 可使用一次 · 已授权匹配战斗槽")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^撤销这一原卷战前授权/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([allow.command, revoke.command]);
  });

  it("blocks stale used-original authorization and omits unprojected originals or absent workshop controls", () => {
    const used = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-1", authorized: true }, "不可重用已耗原卷");
    const missing = action({ type: "AUTHORIZE_SCROLL", scrollId: "missing-original", authorized: true }, "不可授权不存在原卷");
    const value = mystic({ promoted: true, workshop: workshop(), actions: [used, missing] });
    const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^不可重用已耗原卷/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /^不可授权不存在原卷/ })).toBeNull();
    const { workshop: omittedWorkshop, ...withoutWorkshop } = value;
    rerender(<StarMysticPanel starMystic={{ ...withoutWorkshop, actions: [action({ type: "BUY_KIT" }, "缺少公开工坊不可代造")] }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "卷轴工坊与实际原件" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks all mutations and selectors on busy, external block and failed save while retaining actual public states", () => {
    const value = mystic({ promoted: true, cases: cases(), practice: originalPractice, workshop: workshop(), actions: [
      action({ type: "BUY_LENSES" }, "买同一眼镜"), action({ type: "BUY_KIT" }, "买原材料"), action({ type: "CRAFT_SCROLL", kind: "IMPACT" }, "实际刻录"),
      action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-5", authorized: true }, "逐件授权"), action({ type: "OBSERVE", caseId: "veiled-marker" }, "核对原帘"),
    ] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<StarMysticPanel starMystic={value} resources={resources} onCommand={onCommand} {...props} />);
      for (const selector of screen.getAllByRole("combobox")) expect((selector as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(originalPractice.vision)).toBeTruthy(); expect(screen.getByText("晋升后实际冲力原卷")).toBeTruthy();
    }
    rerender(<StarMysticPanel starMystic={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains peaceful100, only projected masteries, bounded G sight and cage, and no S4 creation", async () => {
    const abilities = [{ id: "hermit.s5.mystic-sight", label: "有限窥秘之眼", mastery: 0, description: "尚未分配实际掌握。" },
      { id: "hermit.s5.star-cage", label: "星光囚笼", mastery: 8, description: "只约束实际目标的有限移动。" },
      { id: "hermit.s6.scrollcraft", label: "原卷轴刻录", mastery: 37, description: "原掌握保留。" }];
    const talk = action({ type: "ENCOUNTER_TALK" }, "与布莱斯实际交涉"); const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担布莱斯冲突");
    const { onCommand } = panel(mystic({ promoted: true, acting: 100, digestion: "本阶段已消化", abilities, actions: [talk, fight] }));
    expect((screen.getByRole("progressbar", { name: "星象师扮演进度" }) as HTMLProgressElement).value).toBe(100);
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("星象师能力边界");
    for (const text of ["窥秘人途径序列5星象师", "混乱与风险", "厚镜片过滤", "不等于全知", "3灵性与2精神", "直接星光囚笼", "第三项只提供普通方法", "战斗K耗3灵性、知识14，成功后本轮原对手下一次有效普通打击贡献乘0.5，使用一次或回合结束清除。R须实际戴着原眼镜且本轮尚未聚焦，支付3灵性与2精神后抬镜；下一次K耗去聚焦，只加5个百分点成功率。聚焦耗用或本轮结束戴回原眼镜，不退还资源；没有眼镜时R只有普通观察，不生成眼镜或增益，K仍可按原条件独立施用。", "制作序列6", "制作序列5", "序列4神秘学家", "序列2才是贤者"])
      expect(boundary.textContent).toContain(text);
    const encounter = screen.getByRole("region", { name: "星象师有限冲突" });
    for (const text of ["布莱斯", "自己的普通短棍", "对方不追击", "达芙宁不参加", "不自动耗用卷轴", "不直接扣健康"])
      expect(encounter.textContent).toContain(text);
    await userEvent.click(within(encounter).getByRole("button", { name: /^与布莱斯实际交涉/ }));
    await userEvent.click(within(encounter).getByRole("button", { name: /^承担布莱斯冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /神秘再现|免费|预知未来|召唤达芙宁/ })).toBeNull();
  });

  it("keeps old S6 cases, failures, consumed originals and bottles read-only without relabelling new maker5 scrolls as S6 history", () => {
    const scrollProfessor: ScrollProfessorProjection = {
      title: "卷轴教授", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      story: "原卷轴教授故事与实际失败。", environment: "原卡尔已经重伤投降，原结果保留。", supplies: "原独立瓶供给与真实耗用。",
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险", insideCase: false, workshop: workshop(),
      actions: [{ id: "old-reflect", label: "不可重做旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: [{ id: "willing-reader", title: "原自愿读者米娅", story: "原第一次教学失败，米娅实际拒绝。", status: "RESOLVED",
        observations: ["原卷实际耗用与失败均保留。"], preparation: "本人只同意有限教学。", result: "以后跨周同意，再实际结束并报告。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "scroll-professor-old-1", title: "卷轴教授旧原瓶", source: "原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "scroll-professor-old-1", confirmed: true } }],
      abilities: [{ id: "hermit.s6.scrollcraft", label: "原刻录能力", mastery: 37, description: "原真实刻录掌握。" }],
    };
    render(<StarMysticScrollProfessorHistory scrollProfessor={scrollProfessor} />);
    const history = within(screen.getByRole("region", { name: "卷轴教授时期的经历" }));
    for (const text of ["原卷轴教授故事与实际失败。", "原卡尔已经重伤投降，原结果保留。", "原第一次教学失败，米娅实际拒绝。", "原案卷ID：willing-reader",
      "原卷实际耗用与失败均保留。", "当时的方式与准备：本人只同意有限教学。", "当时的实际结果与报告：以后跨周同意，再实际结束并报告。",
      "原卷轴ID：SP6-scroll-1", "制作周：41 · 制作者序列：6 · 刻录时掌握：12", "耗用周：49", "原瓶ID：scroll-professor-old-1", "来源：原独立成品渠道", "已耗用 · 原失败保留",
      "有限牵引 · 已实际学会", "短时护持 · 尚未学会", "原法术ID：light-touch", "原刻录能力 · 掌握 37：原真实刻录掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByText("晋升后实际冲力原卷")).toBeNull(); expect(history.queryByText("不可重做旧成长")).toBeNull();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
