/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrimsonScholarAction, CrimsonScholarCommand, CrimsonScholarProjection } from "../../src/domain/crimson-scholar/types";
import type { PotionProfessorProjection } from "../../src/domain/potion-professor/types";
import { CrimsonScholarPanel, CrimsonScholarPotionProfessorHistory } from "../../src/renderer/CrimsonScholarPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyResources: SeerResources = { ...resources, health: 1, mind: 0, spirituality: 0, cash: "0便士", actionsRemaining: 0 };
const risk = "意志26四档：大成功精神−5，成功精神−10；失败精神−20、健康−10、排异+25，灾难精神−40、健康−20、排异+50。失败原瓶照耗，不晋升。";
const announcement = "第53周 · 1350年6月28日：原夜间药房发布的真实满月夜，事件CS-MOON-53。";
function action(command: CrimsonScholarCommand, label = "执行公开行动", enabled = true, cost = "公开成本"): CrimsonScholarAction {
  return { id: JSON.stringify(command), label, command, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。" };
}
function scholar(patch: Partial<CrimsonScholarProjection> = {}): CrimsonScholarProjection {
  return {
    title: "深红学者晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [], bottles: [], abilities: [], acting: 0,
    digestion: "魔药教授消化100，已度过12/12个完整序列6周。", pollution: 3, risk,
    cases: [], insideCase: false, environment: "", practice: null,
    ritual: { summary: "按原屋顶公告核对真实满月，不以区域场域代替。", announcements: [announcement], reservation: "尚未预约。", activeVisit: "当前不在晋升屋顶。", history: [] },
    ...patch,
  };
}
function cases(): CrimsonScholarProjection["cases"] {
  return [
    { id: "full-moon", title: "原小院里的有限满月", story: "原5米区，成年观察者自愿参加并留在区外。" },
    { id: "hidden-moon", title: "同一原小院的隐月与遮光对照", story: "原5米区对照原遮光板，物主仍是艾琳。" },
    { id: "moonlight-route", title: "原月照通路上的真实去程与返程", story: "第三项原10米区，两处原地面标记相距6米，普通步行与月光闪现分别记录。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function promoted(patch: Partial<CrimsonScholarProjection> = {}): CrimsonScholarProjection {
  return scholar({ promoted: true, cases: cases(), practice: { field: "NONE", location: "START", outboundTrips: 0, returns: 0, reassemblies: 0, reassembledWeek: null }, ...patch });
}
function bottled(): CrimsonScholarProjection {
  const originals = [
    { id: "crimson-scholar-potion-1", title: "第一瓶深红学者魔药", source: "艾琳原渠道第一瓶独立成品", chance: 71 },
    { id: "crimson-scholar-potion-2", title: "第二瓶深红学者魔药", source: "艾琳原渠道第二瓶独立成品", chance: 43 },
    { id: "crimson-scholar-potion-3", title: "第三瓶深红学者魔药", source: "艾琳原渠道第三瓶独立成品", chance: 61 },
  ];
  return scholar({ guidanceKnown: true, insideCase: true,
    supplies: "每批三瓶独立原瓶，各自五步劳务后付600便士；跨周补给保留旧原瓶记录。",
    ritual: { ...scholar().ritual, reservation: "已预约CS-MOON-53。", activeVisit: "第53周在原露天屋顶，艾琳本人在场；真实满月照耀，已耗用封装包CS-KIT-1，尚未服药。", history: ["到访1：CS-KIT-1已耗尽，本次至多服一瓶。"] },
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗这一原瓶 · 本次到访一瓶")),
    bottles: originals.map((bottle): CrimsonScholarProjection["bottles"][number] => ({ ...bottle, status: "实际持有，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function panel(value: CrimsonScholarProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<CrimsonScholarPanel crimsonScholar={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
function button(name: string) { return screen.getByRole("button", { name: new RegExp(`^${name}`) }) as HTMLButtonElement; }
afterEach(cleanup);

describe("Crimson scholar public ritual, originals and actual body position", () => {
  it("shows the S6 maturity gate, independent G costs, sequence order and unknown formula", () => {
    const reason = "魔药教授消化100；已度过11/12个完整序列6周，尚未成熟。";
    const value = scholar({ digestion: reason, formula: [{ name: "未核实配方材料", quantity: 5, unit: "克" }],
      actions: [{ ...action({ type: "LEARN_GUIDANCE" }, "听取深红学者指导", false), reason }] });
    const { onCommand } = panel(value);
    const summary = screen.getByRole("region", { name: "深红学者成长下一步" });
    for (const text of [reason, "药师9 → 驯兽师8 → 吸血鬼7 → 魔药教授6 → 深红学者5", "指导460便士", "每瓶4800便士", "5步劳务后付600便士", "意志26", "完整晋升配方仍未知", "非人幻想生物"])
      expect(summary.textContent).toContain(text);
    expect(button("听取深红学者指导").disabled).toBe(true); fireEvent.click(button("听取深红学者指导"));
    expect(screen.queryByText("未核实配方材料")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards guidance, exact per-bottle labour, payment and cross-week supply commands", async () => {
    const commands: CrimsonScholarCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "crimson-scholar-potion-3" },
      { type: "BUY_POTION", bottleId: "crimson-scholar-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取原指导", "完成第三原瓶第五步劳务", "支付第三瓶余款", "申请下一周补给", "接收实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5", "600便士 · 0行动", "1行动 · 下一真实周", "0行动 · 新批三瓶到货，旧原瓶身份保留"];
    const { onCommand } = panel(scholar({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(button(label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("renders actual announced event dates and cancellation without inventing another full moon", async () => {
    const reservation = "已预约第53周CS-MOON-53；目前第51周，尚未到真实事件周。";
    const value = scholar({ ritual: { ...scholar().ritual, reservation }, actions: [
      action({ type: "CANCEL_RITUAL" }, "取消原未来预约", true, "0行动 · 公告不变"),
      { ...action({ type: "BEGIN_RITUAL" }, "到原屋顶准备材料", false, "1行动 · 150便士"), reason: "只能在已预约的第53周真实满月夜到场。" },
    ] });
    const { onCommand } = panel(value, vi.fn(), emptyResources);
    expect(screen.getByText(announcement)).toBeTruthy(); expect(screen.getByText(reservation)).toBeTruthy();
    expect(button("到原屋顶准备材料").disabled).toBe(true);
    await userEvent.click(button("取消原未来预约"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CANCEL_RITUAL" });
    expect(screen.getByText(announcement)).toBeTruthy(); expect(screen.getByText(reservation)).toBeTruthy();
    expect(screen.getByRole("region", { name: "深红学者成长下一步" }).textContent).toContain("取消原未来预约");
    expect(screen.queryByText(/每四周|每4周/)).toBeNull();
  });

  it("requests and begins only public ritual actions, preserving the unpaid saved visit until receipt", async () => {
    const commands: CrimsonScholarCommand[] = [{ type: "REQUEST_RITUAL" }, { type: "BEGIN_RITUAL" }];
    const { onCommand } = panel(scholar({ actions: [action(commands[0]!, "预约下一已公告事件", true, "1行动"), action(commands[1]!, "实际到场并耗用封装包", true, "1行动 · 150便士")] }));
    await userEvent.click(button("预约下一已公告事件")); await userEvent.click(button("实际到场并耗用封装包"));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText("当前不在晋升屋顶。")).toBeTruthy();
    const ritual = screen.getByRole("region", { name: "真实满月公告与晋升仪式" });
    for (const text of ["已公告的未来事件", "每次到访至多服一瓶", "材料均不返还", "区域满月不能代替真实满月"])
      expect(ritual.textContent).toContain(text);
  });

  it("prioritizes actual ritual departure even after promotion with no AP, mind or spirituality", async () => {
    const value = promoted({ insideCase: true, actions: [action({ type: "REFLECT" }, "回看有限实践"), action({ type: "END_RITUAL" }, "实际结束本次满月仪式", true, "0行动 · 已耗用材料不退")],
      ritual: { ...scholar().ritual, activeVisit: "第53周已服用第二瓶并晋升，尚须实际离开原屋顶。", history: ["第53周：CS-KIT-1与crimson-scholar-potion-2均已耗用。"] } });
    const { onCommand } = panel(value, vi.fn(), emptyResources);
    expect(screen.getByRole("region", { name: "深红学者成长下一步" }).textContent).toContain("实际结束本次满月仪式");
    expect(button("实际结束本次满月仪式").disabled).toBe(false);
    await userEvent.click(button("实际结束本次满月仪式"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" });
    expect(screen.getByText("第53周：CS-KIT-1与crimson-scholar-potion-2均已耗用。")).toBeTruthy();
  });

  it("allows the enabled original bottle during an occupied actual ritual visit", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    expect(value.insideCase).toBe(true);
    expect(button("查看并准备服用「第一瓶深红学者魔药」").disabled).toBe(false);
    await userEvent.click(button("查看并准备服用「第一瓶深红学者魔药」"));
    expect(screen.getByRole("region", { name: "服药前的实际仪式" }).textContent).toContain(value.ritual.activeVisit);
    expect(screen.getByText("crimson-scholar-potion-1")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("cancels confirmation by Escape or button without leaving the ritual and restores focus", async () => {
    const { onCommand } = panel(bottled());
    const open = button("查看并准备服用「第一瓶深红学者魔药」"); open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶深红学者魔药" }));
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button("查看并准备服用「第一瓶深红学者魔药」"));
    await userEvent.click(button("查看并准备服用「第三瓶深红学者魔药」")); await userEvent.click(button("暂不服用"));
    expect(document.activeElement).toBe(button("查看并准备服用「第三瓶深红学者魔药」"));
    expect(screen.getByText(bottled().ritual.activeVisit)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the chosen independent original, four-tier risk and current resources before confirming once", async () => {
    const { onCommand } = panel(bottled()); await userEvent.click(button("查看并准备服用「第二瓶深红学者魔药」"));
    expect(screen.getByText("crimson-scholar-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：艾琳原渠道第二瓶独立成品")).toBeTruthy();
    expect(screen.getByRole("region", { name: "深红学者服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = button("确认服用「第二瓶深红学者魔药」"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "crimson-scholar-potion-2", confirmed: true });
    expect(confirm.disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("honors busy, blocked and the public disabled reason without using resource-derived guesses", () => {
    const value = bottled(); value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "本次到访已经服用一瓶，须实际退出后另约未来事件。" };
    const { onCommand, rerender } = panel(value);
    expect(button("查看并准备服用「第一瓶深红学者魔药」").disabled).toBe(true);
    expect(screen.getByText(value.actions[0]!.reason!)).toBeTruthy(); fireEvent.click(button("查看并准备服用「第一瓶深红学者魔药」"));
    rerender(<CrimsonScholarPanel crimsonScholar={value} resources={resources} busy={true} onCommand={onCommand} />);
    expect(button("查看并准备服用「第二瓶深红学者魔药」").disabled).toBe(true);
    rerender(<CrimsonScholarPanel crimsonScholar={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    expect(button("查看并准备服用「第三瓶深红学者魔药」").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains a submitted confirmation during save failure and leaves retry with the outer save owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(button("查看并准备服用「第一瓶深红学者魔药」")); await userEvent.click(button("确认服用「第一瓶深红学者魔药」"));
    const error = { message: "这次服药未保存，请重试原操作。", retryable: true };
    rerender(<CrimsonScholarPanel crimsonScholar={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(button("确认服用「第一瓶深红学者魔药」"));
    expect(screen.getByText("crimson-scholar-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<CrimsonScholarPanel crimsonScholar={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(button("正在结算并保存…").disabled).toBe(true);
  });

  it("keeps the failed original and used kit in history and requires departure before another attempt", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(button("查看并准备服用「第一瓶深红学者魔药」")); await userEvent.click(button("确认服用「第一瓶深红学者魔药」"));
    const failed = { ...value,
      actions: [action({ type: "END_RITUAL" }, "结束失败后的原仪式", true, "0行动")],
      bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原瓶已耗用，失败与排异保留" } : bottle),
      ritual: { ...value.ritual, activeVisit: "本次已服一瓶失败，不能再服第二瓶。", history: ["CS-KIT-1与crimson-scholar-potion-1已耗用；第53周失败保留。"] },
    };
    rerender(<CrimsonScholarPanel crimsonScholar={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶深红学者魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗用，失败与排异保留")).toBeTruthy(); expect(screen.getByText(failed.ritual.history[0]!)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    await userEvent.click(button("结束失败后的原仪式")); expect(onCommand).toHaveBeenLastCalledWith({ type: "END_RITUAL" });
    expect(screen.getByText("本次已服一瓶失败，不能再服第二瓶。")).toBeTruthy();
  });

  it("dismisses confirmation only after committed promotion and retains the actual departure action", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(button("查看并准备服用「第三瓶深红学者魔药」")); await userEvent.click(button("确认服用「第三瓶深红学者魔药」"));
    const next = promoted({ ...value, promoted: true, actions: [action({ type: "END_RITUAL" }, "离开晋升原屋顶", true, "0行动")],
      bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用，已晋升深红学者" } : bottle) });
    rerender(<CrimsonScholarPanel crimsonScholar={next} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶深红学者魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗用，已晋升深红学者")).toBeTruthy(); expect(button("离开晋升原屋顶").disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects three independent cases and forwards ordinary and ability preparation without optimistic effects", async () => {
    const commands: CrimsonScholarCommand[] = [{ type: "OBSERVE", caseId: "full-moon" }, { type: "PREPARE", caseId: "full-moon", method: "ABILITY" },
      { type: "PREPARE", caseId: "full-moon", method: "ORDINARY" }, { type: "PERFORM", caseId: "full-moon" }, { type: "REPORT", caseId: "full-moon" }];
    const labels = ["观察原5米区", "准备有限满月", "准备普通月光对照", "实际进行有限比较", "报告实际比较"];
    const { onCommand } = panel(promoted({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
    }
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "full-moon");
    for (const label of labels) await userEvent.click(button(label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText("无持续场域")).toBeTruthy(); expect(screen.getByText("原路线起点")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "月相与移动的实际结果" })).toBeNull();
  });

  it("closes at zero resources but leaves the body at END until an independently saved return", async () => {
    const route = cases().map((entry) => entry.id === "moonlight-route" ? { ...entry, status: "EXAMINED", result: "本人实际闪现6米到原终点，须停止场域再返回。", contactOpen: "接触尚未结束" } : entry);
    const close = action({ type: "CLOSE", caseId: "moonlight-route" }, "停止原月场与接触", true, "0行动 · 0灵性");
    const back = action({ type: "RETURN" }, "沿原6米通路返回", false, "0行动 · 0灵性");
    const value = promoted({ insideCase: true, cases: route, practice: { field: "FULL", location: "END", outboundTrips: 1, returns: 0, reassemblies: 0, reassembledWeek: null }, actions: [back, close] });
    const { onCommand, rerender } = panel(value, vi.fn(), emptyResources);
    expect(screen.getByRole("region", { name: "深红学者成长下一步" }).textContent).toContain("停止原月场与接触");
    expect(button("停止原月场与接触").disabled).toBe(false); expect(button("沿原6米通路返回").disabled).toBe(true);
    await userEvent.click(button("停止原月场与接触")); expect(screen.getByText("区域满月仍在持续")).toBeTruthy();
    const closed = { ...value, practice: { ...value.practice!, field: "NONE" as const }, actions: [{ ...back, enabled: true, reason: null }] };
    rerender(<CrimsonScholarPanel crimsonScholar={closed} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("无持续场域")).toBeTruthy(); expect(screen.getByText("6米路线终点，尚未原路返回")).toBeTruthy();
    expect(screen.getByRole("region", { name: "深红学者成长下一步" }).textContent).toContain("沿原6米通路返回");
    await userEvent.click(button("沿原6米通路返回")); expect(screen.getByText("6米路线终点，尚未原路返回")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "moonlight-route" }, { type: "RETURN" }]);
    rerender(<CrimsonScholarPanel crimsonScholar={{ ...closed, insideCase: false, practice: { ...closed.practice, location: "START", returns: 1 }, actions: [] }} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原路线起点")).toBeTruthy();
  });

  it("on reload selects the actual route endpoint even after the close action has disappeared", () => {
    panel(promoted({ insideCase: true, practice: { field: "NONE", location: "END", outboundTrips: 2, returns: 1, reassemblies: 0, reassembledWeek: null },
      actions: [action({ type: "RETURN" }, "走回原起点", true, "0行动")] }));
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("moonlight-route"); expect(selector.disabled).toBe(true);
    expect(screen.getByText(cases()[2]!.story)).toBeTruthy(); expect(screen.getByText("6米路线终点，尚未原路返回")).toBeTruthy();
    expect(button("走回原起点").disabled).toBe(false);
  });

  it("distinguishes saved hidden fields, paid reassembly attempts and limited living-body recovery", async () => {
    const value = promoted({ insideCase: true, practice: { field: "HIDDEN", location: "START", outboundTrips: 0, returns: 0, reassemblies: 1, reassembledWeek: 54 },
      actions: [action({ type: "REASSEMBLE" }, "有限重组原身体", false, "1行动 · 8灵性 · 每周一次尝试"), action({ type: "CLOSE", caseId: "hidden-moon" }, "停止隐月", true, "0行动")] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("区域隐藏月亮仍在持续")).toBeTruthy(); expect(screen.getByText("54")).toBeTruthy();
    expect(screen.getByText("重组尝试")).toBeTruthy(); expect(button("有限重组原身体").disabled).toBe(true);
    const boundary = screen.getByRole("region", { name: "深红学者能力边界" });
    for (const text of ["5米区", "10米通路区", "相距6米", "3、3、6灵性", "成年观察者与导师始终在场域外", "不是血液化", "健康1至99", "失败照耗", "不清除伤势", "不要求制造伤势或使用重组"])
      expect(boundary.textContent).toContain(text);
    const full = { ...value, practice: { ...value.practice!, field: "FULL" as const }, actions: [action({ type: "REASSEMBLE" }, "有限重组原身体", true, "1行动 · 8灵性")] };
    rerender(<CrimsonScholarPanel crimsonScholar={full} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(button("有限重组原身体")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REASSEMBLE" });
    expect(screen.getByText("54")).toBeTruthy();
  });

  it("prioritizes an enabled withdrawal at zero resources and reports an outer unretryable error", async () => {
    const value = promoted({ actions: [action({ type: "PERFORM", caseId: "full-moon" }, "执行本次满月", false), action({ type: "WITHDRAW", caseId: "full-moon" }, "撤回待执行准备", true, "0行动")] });
    const { onCommand, rerender } = panel(value, vi.fn(), emptyResources);
    expect(screen.getByRole("region", { name: "深红学者成长下一步" }).textContent).toContain("撤回待执行准备");
    await userEvent.click(button("撤回待执行准备")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "full-moon" });
    rerender(<CrimsonScholarPanel crimsonScholar={value} resources={emptyResources} busy={false} error={{ message: "保存版本不符。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
    expect(button("撤回待执行准备").disabled).toBe(true); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves prior professor outcomes, owned and used assistance originals and consumed promotion bottles read-only", () => {
    const history: PotionProfessorProjection = {
      title: "魔药教授", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: "原三瓶供给已保存。", story: "原导师教学记录。",
      actions: [{ id: "old-action", label: "不应再提供旧配制", cost: "1行动", enabled: true, reason: null, command: { type: "BUY_KIT" } }],
      bottles: [{ id: "professor-potion-2", title: "原第二瓶魔药教授魔药", source: "原成品渠道", status: "已服用成功", chance: 60, command: { type: "CONSUME", bottleId: "professor-potion-2", confirmed: true } }],
      abilities: [{ id: "moon.s6.support-potions", label: "辅助药原掌握", mastery: 16, description: "四种独立辅助药仍按原限制。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原风险", insideCase: false, environment: "旧现场已经实际结束。",
      cases: [{ id: "separate-signals", title: "分开痕迹", story: "原三瓶分别使用。", observations: ["身体透明没有自动去味。"], preparation: null, result: "原三瓶均耗用并结束短效。", status: "RESOLVED", contactOpen: "已结束", closes: 1 }],
      laboratory: { summary: "原实验室记录保留。", materials: "仍持有1份原教学材料。", effects: { quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false },
        potions: [{ id: "PP6-7", kind: "QUIET_STEP", title: "实际持有的静步原瓶", source: "第42周原配制", status: "实际持有，尚未使用", brewedWeek: 42, usedWeek: null },
          { id: "PP6-8", kind: "BODY_VEIL", title: "已耗用的身体透明原瓶", source: "第43周原配制", status: "已经耗用，原记录保留", brewedWeek: 43, usedWeek: 44 }] },
    };
    render(<CrimsonScholarPotionProfessorHistory potionProfessor={history} />);
    const region = screen.getByRole("region", { name: "魔药教授时期的经历" });
    for (const text of ["PP6-7", "PP6-8", "尚未耗用", "耗用周：44", "仍持有1份原教学材料", "professor-potion-2", "已服用成功", "身体透明没有自动去味", "原三瓶均耗用并结束短效", "掌握 16"])
      expect(region.textContent).toContain(text);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("不应再提供旧配制")).toBeNull();
  });
});
