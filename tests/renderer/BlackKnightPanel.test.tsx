/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLACK_KNIGHT_CONSUMPTION_RISK } from "../../src/domain/black-knight/content";
import { BLACK_KNIGHT_ENCOUNTER_STORY, BLACK_KNIGHT_POWERS, createBlackKnightEncounterState } from "../../src/domain/black-knight/encounter";
import type { BlackKnightAction, BlackKnightCommand, BlackKnightProjection } from "../../src/domain/black-knight/types";
import type { ShepherdProjection } from "../../src/domain/shepherd/types";
import { BlackKnightPanel, BlackKnightShepherdHistory } from "../../src/renderer/BlackKnightPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 120,
  cash: "7200便士", actionsRemaining: 0 };
const urge = "想为快速获胜忽视原灵界限" as const;
const bodyChange = "原身体与性别记录保持，黑骑士没有新增身体变化。";
function action(command: BlackKnightCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): BlackKnightAction {
  return { id: JSON.stringify(command), label, command, enabled, cost, reason };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取伊森的黑骑士指导", true, "1行动 · 540便士");
function cases(): BlackKnightProjection["cases"] {
  return ([
    { id: "shadow-boundary", title: "灯下同一原影的有限约束", story: "成年文森在BK4-LAMP-1前本次同意，原身体与原影在2米内。" },
    { id: "blade-panel", title: "原隔板留下的切口", story: "原BK4-PANEL-1后无人，使用同一原钝棍或原手工工具。" },
    { id: "one-spirit-account", title: "原伊芮斯与同一张原卡", story: "原卡BK4-CARD-1与1米标记，借用本人当前驱使的原伊芮斯，或普通步行。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "原接触尚未开启", closes: 0 }));
}
const practice: NonNullable<BlackKnightProjection["practice"]> = {
  shadow: "BK4-LAMP-1真实点亮，原影没有被约束。", panel: "BK4-PANEL-1已有1道真实切口，原工具在导师处。",
  card: "同一BK4-CARD-1在原桌，当前未借法。", route: "本人在DESK，已实际普通往返2米。", history: ["第80周原板能力尝试成功，切口保留。"],
};
function shade(patch: Partial<NonNullable<BlackKnightProjection["shade"]>> = {}): NonNullable<BlackKnightProjection["shade"]> {
  return { status: "NOT_CREATED", room: "原灯亮，原房间AVAILABLE。", creature: "没有生成生物。", kit: "唯一BK4-CASK-1与两张BK4-SEAL-1/2及BK4-EXIT-SEAL-1实际持有。",
    route: "本人ROOM，已沿普通门走2米，出口CLEAR，导师OUTSIDE。", cost: "已付180便士、1行动；生成费用尚未支付。", warning: "独立生物不受本人控制，不是宠物或净化人格。", ...patch };
}
function grazing(): NonNullable<BlackKnightProjection["grazing"]> {
  return { met: true, capacity: 7, activeSpiritId: "SH5-IRIS-1", summary: "同一原名册两条，实际一灵放牧、一灵永久释放。", spirits: [
    { id: "SH5-IRIS-1", name: "伊芮斯", source: "原导师第一独立容器中的已故成年巫师原灵。", status: "GRAZED", selectedAbilities: ["light-touch", "brief-ward", "blur-mark"],
      attemptWeek: 56, acquiredWeek: 56, releasedWeek: null, knownAbilities: [{ id: "light-touch", label: "轻触术", description: "她原有的有限牵引。" },
        { id: "brief-ward", label: "短促防护", description: "她原有的有限护持。" }, { id: "blur-mark", label: "模糊标记", description: "她原有的有限模糊。" }] },
    { id: "SH5-CEDRIC-1", name: "塞德里克", source: "原导师另一容器中的已故成年歌颂者原灵。", status: "RELEASED", selectedAbilities: ["courage-song"],
      attemptWeek: 57, acquiredWeek: 57, releasedWeek: 64, knownAbilities: [{ id: "courage-song", label: "勇气歌声", description: "旧选择保留，永久释放后不能借用。" }] },
  ] };
}
function reserve(): NonNullable<BlackKnightProjection["reserve"]> {
  return { points: 1, max: 3, packetsBought: 2, lastPurchaseWeek: 60, summary: "原蔷薇主教渠道与原份额不补满。", packets: [
    { id: "RB6-packet-1", acquiredWeek: 40, status: "CONSUMED", consumedWeek: 42 },
    { id: "RB6-packet-2", acquiredWeek: 60, status: "HELD", consumedWeek: null },
  ] };
}
function knight(patch: Partial<BlackKnightProjection> = {}): BlackKnightProjection {
  return { title: "黑骑士晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "独立黑骑士原渠道，三瓶分别记录劳务和成本。", inheritedTools: "同一原灵名册与原血肉储备继续使用。", bodyChange,
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "牧羊人消化100且晋升后满12真实整周。", pollution: 3,
    risk: BLACK_KNIGHT_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "原灯房与相邻原板、原卡房间。", practice: null,
    shade: null, encounter: null, grazing: null, ...patch };
}
function bottled(): BlackKnightProjection {
  const bottles: BlackKnightProjection["bottles"] = [1, 2, 3].map(number => ({ id: `black-knight-potion-${number}`, title: `第${number}瓶黑骑士原瓶`,
    source: `伊森独立渠道第${number}瓶原成品`, status: "实际持有，尚未服用", chance: 69 + number,
    command: { type: "CONSUME", bottleId: `black-knight-potion-${number}`, confirmed: true } }));
  return knight({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command, `查看并服用${bottle.title}`, true, "0行动 · 耗用这一原瓶")) });
}
function trained(patch: Partial<BlackKnightProjection> = {}): BlackKnightProjection {
  return knight({ promoted: true, cases: cases(), practice: structuredClone(practice), shade: shade(), actions: [], grazing: grazing(), reserve: reserve(),
    abilities: [{ id: "hanged-man.s4.flesh-soul-blade", label: "灵肉之刃", mastery: 8, description: "本人实际成功接触原板后留下切口。" },
      { id: "hanged-man.s4.shadow-command", label: "统御真实阴影", mastery: 0, description: "本人须实际施术，仍可抵抗。" },
      { id: "hanged-man.s4.fallen-shadow", label: "独立堕落之影", mastery: 0, description: "尚未真实生成独立生物。" }], ...patch });
}
function encounter(patch: Partial<NonNullable<BlackKnightProjection["encounter"]>> = {}): NonNullable<BlackKnightProjection["encounter"]> {
  return { ...createBlackKnightEncounterState(), name: "加里克·诺尔", story: BLACK_KNIGHT_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原净空附院的开放普通出口", pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: BLACK_KNIGHT_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: BlackKnightProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BlackKnightPanel blackKnight={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: BlackKnightProjection, onCommand: (command: BlackKnightCommand) => void) {
  return <BlackKnightPanel blackKnight={value} resources={resources} busy={false} onCommand={onCommand} />;
}
const spawn = () => action({ type: "SPAWN_SHADE", confirmed: true, acknowledgedUrge: urge }, "准备生成唯一原堕落之影", true, "1行动 · 5灵性 · 5精神");
const release = () => action({ type: "RELEASE_SPIRIT", spiritId: "SH5-IRIS-1", confirmed: true }, "准备永久释放伊芮斯", true, "0行动 · 永久失去原灵及借法");
afterEach(cleanup);

describe("Black Knight independent acquisition and committed confirmations", () => {
  it("keeps the unknown full formula separate from explicit G maturity, labour and supply costs", () => {
    const reason = "牧羊人晋升后只经过11/12真实整周。";
    const { onCommand } = panel(knight({ digestion: reason, formula: [{ name: "不应显示的猜测配方", quantity: 9, unit: "份" }], actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "黑骑士配方与成品边界" });
    for (const text of ["仍未知", "指导服药", "100", "12", "28", "540", "6800", "五次", "5300", "1500", "下一真实周", "继续牧羊人生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "黑骑士成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("不应显示的猜测配方")).toBeNull(); expect(button(learn.label).disabled).toBe(true);
    fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards separate original labour, payment and actual resupply intents without local changes", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "black-knight-potion-2" }, "完成第二瓶实际劳务", true, "1行动 · 本瓶5/5步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "black-knight-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    const request = action({ type: "REQUEST_SUPPLY" }, "申请下一真实周供给"); const receive = action({ type: "RECEIVE_SUPPLY" }, "登记同一实际到货");
    value.actions = [work, buy, request, receive]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立黑骑士原瓶" }), "black-knight-potion-2");
    for (const entry of value.actions) await userEvent.click(button(entry.label));
    value.actions.forEach((entry, index) => expect(onCommand.mock.calls[index]![0]).toBe(entry.command)); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle, cancels, and returns keyboard focus to that bottle action", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立黑骑士原瓶" }), bottle.id);
      const entry = value.actions.find(item => "bottleId" in item.command && item.command.bottleId === bottle.id)!;
      button(entry.label).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: bottle.title })); expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy();
      await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(entry.label));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("discloses four actual outcomes and current resources, then submits the selected bottle once", async () => {
    const value = bottled(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); const review = screen.getByRole("region", { name: "这瓶黑骑士魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "黑骑士服用风险与四档结果" }).textContent).toContain(BLACK_KNIGHT_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", "不补满灵性", "原伊芮斯"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    expect(confirm.disabled).toBe(true); expect(value).toEqual(before);
  });

  it("retains a submitted review through save failure and leaves same-intent retries to the outer owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<BlackKnightPanel blackKnight={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶黑骑士魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale bottle review only after the committed source changed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "原瓶已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶黑骑士魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks all interactions when %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<BlackKnightPanel blackKnight={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} readOnly={condition === "readOnly"}
      error={condition === "error" ? { message: "保存尚未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Black Knight actual cases and inherited one-soul controls", () => {
  it("shows all three source-bound cases, original cuts and a peaceful ordinary completion route", async () => {
    panel(trained());
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前黑骑士生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "黑骑士原影原板与原卡的实际状态" });
    for (const text of [practice.shadow, practice.panel, practice.card, practice.route]) expect(facts.textContent).toContain(text);
    await userEvent.click(screen.getByText("已观察的事实与普通方法")); expect(screen.getByRole("region", { name: "黑骑士有限生活实践" }).textContent).toContain("可全程普通方法和平消化100");
    expect(screen.getByText("独立堕落之影 · 掌握 0")).toBeTruthy(); expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
  });

  it("forwards ability and ordinary preparation without pretending either has executed", async () => {
    const actions = [action({ type: "PREPARE", caseId: "shadow-boundary", method: "ABILITY" }, "准备原影能力方法", true, "1行动 · 尚未束缚"),
      action({ type: "PREPARE", caseId: "shadow-boundary", method: "ORDINARY" }, "准备普通边界观察", true, "1行动 · 不增加掌握")];
    const value = trained({ actions }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of actions) await userEvent.click(button(entry.label));
    actions.forEach((entry, index) => expect(onCommand.mock.calls[index]![0]).toBe(entry.command)); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "黑骑士原影原板与原卡的实际状态" }).textContent).toContain("没有被约束");
  });

  it("keeps failed paid attempts and zero-AP card return separate from closing", async () => {
    const retry = action({ type: "PERFORM", caseId: "one-spirit-account" }, "下周再借原轻触术", false, "1行动 · 2灵性", "本周失败已付成本，下一真实周重试。");
    const back = action({ type: "RETURN_ROUTE", caseId: "one-spirit-account" }, "沿原一米路线取回同一卡", true, "0行动 · 实际走路");
    const close = action({ type: "CLOSE", caseId: "one-spirit-account" }, "结束本次原灵借用", false, "0行动", "先实际取回原卡并走回原桌。");
    const value = trained({ insideCase: true, cases: cases().map(entry => entry.id === "one-spirit-account" ? { ...entry, status: "OBSERVED", contactOpen: "接触仍开", result: "本次借法失败，2灵性已实际消耗。" } : entry),
      practice: { ...practice, card: "原卡仍在原标记。", route: "本人MARK，尚须实际回到DESK。" }, actions: [retry, back, close] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "黑骑士成长下一步" }).textContent).toContain(back.label);
    expect((screen.getByRole("combobox", { name: "选择当前黑骑士生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    expect(button(retry.label).disabled).toBe(true); expect(button(close.label).disabled).toBe(true); expect(button(back.label).disabled).toBe(false);
    await userEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "黑骑士实际实践结果" }).textContent).toContain("2灵性已实际消耗");
  });

  it("shows exactly the original active Iris and never restores released Cedric controls", async () => {
    const stop = action({ type: "ACTIVATE_SPIRIT", spiritId: null }, "仅使用本人能力");
    const activate = action({ type: "ACTIVATE_SPIRIT", spiritId: "SH5-IRIS-1" }, "明确驱使同一伊芮斯");
    const invalid = action({ type: "ACTIVATE_SPIRIT", spiritId: "SH5-CEDRIC-1" }, "不应出现的已释放控制");
    const value = trained({ actions: [stop, activate, invalid] }), before = structuredClone(value), { onCommand } = panel(value);
    const roster = screen.getByRole("region", { name: "黑骑士继承灵魂名册与当前驱使" });
    for (const text of ["实际放牧 1 / 7", "当前驱使：伊芮斯", "同时只驱使1灵", "每灵最多3项", "没有免费半神灵库", "塞德里克", "永久释放", "64"]) expect(roster.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /不应出现的已释放控制/ })).toBeNull();
    await userEvent.click(button(stop.label)); await userEvent.click(button(activate.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([stop.command, activate.command]); expect(value).toEqual(before);
    expect(roster.textContent).toContain("当前驱使：伊芮斯"); expect(screen.queryByRole("button", { name: /外化|外放|获得半神|双灵/ })).toBeNull();
  });

  it("keeps unmet identities hidden and accepts ordinary case methods with no owned spirit", async () => {
    const original = grazing(); original.met = false; original.activeSpiritId = null; original.spirits.forEach(spirit => { spirit.status = "UNMET"; });
    const ordinary = action({ type: "PREPARE", caseId: "one-spirit-account", method: "ORDINARY" }, "普通步行搬原卡");
    const value = trained({ grazing: original, actions: [ordinary] }), { onCommand } = panel(value);
    const roster = screen.getByRole("region", { name: "黑骑士继承灵魂名册与当前驱使" });
    expect(roster.textContent).toContain("原身份与能力保持未知"); expect(within(roster).queryByText(/原灵魂ID/)).toBeNull();
    await userEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("independently reviews permanent original-soul release and guards against double dispatch", async () => {
    const entry = release(), value = trained({ actions: [entry] }), before = structuredClone(value), { onCommand } = panel(value);
    button(entry.label).focus(); await userEvent.keyboard("{Enter}"); const review = screen.getByRole("region", { name: "永久释放这一原灵的独立确认" });
    for (const text of ["SH5-IRIS-1", "当前已选能力", "永久失去", "不能撤销", "同时停止驱使"]) expect(review.textContent).toContain(text);
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(entry.label)); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button(entry.label)); const confirm = button("确认永久释放"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
  });

  it("shows actual reserve and only the held original packet as usable", async () => {
    const buy = action({ type: "BUY_RATION" }, "购买原渠道一份供给", true, "1行动 · 原价格");
    const take = action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "取用同一持有原包", true, "0行动 · 消耗原包");
    const spent = action({ type: "TAKE_RATION", packetId: "RB6-packet-1" }, "不应重用旧耗尽原包");
    const value = trained({ actions: [buy, take, spent] }), before = structuredClone(value), { onCommand } = panel(value);
    const record = screen.getByRole("region", { name: "黑骑士继承血肉储备与原供给包" });
    for (const text of ["血肉储备 1 / 3", "RB6-packet-1", "RB6-packet-2", "已实际耗用", "42", "不自动补充"]) expect(record.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /不应重用旧耗尽/ })).toBeNull();
    await userEvent.click(button(take.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(take.command); expect(value).toEqual(before);
  });
});

describe("Black Knight optional independent shade and actual cleanup", () => {
  it("requires a deliberate fictional-urge acknowledgement before sending confirmed spawn once", async () => {
    const entry = spawn(), value = trained({ actions: [entry] }), before = structuredClone(value), { onCommand } = panel(value);
    button(entry.label).focus(); await userEvent.keyboard("{Enter}");
    const review = screen.getByRole("region", { name: "生成独立堕落之影的明确确认" });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "确认让这一堕落之影独立存在" }));
    for (const text of [urge, "BK4-SHADE-1", "不受控制", "不是宠物", "5灵性", "5精神", "自主走2米", "熄灯", "知识18", "两张封条", "精神−3", "BK4-EXIT-SEAL-1", "永久隔离", "仍留在里面"]) expect(review.textContent).toContain(text);
    const confirm = button("确认付费生成独立堕落之影"); expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(urge) })); expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command);
    expect(entry.command).toEqual({ type: "SPAWN_SHADE", confirmed: true, acknowledgedUrge: urge }); expect(value).toEqual(before);
  });

  it("cancels spawn with focus restoration and does not retain acknowledgement for a later attempt", async () => {
    const entry = spawn(), { onCommand } = panel(trained({ actions: [entry] }));
    await userEvent.click(button(entry.label)); await userEvent.click(screen.getByRole("checkbox")); await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(button(entry.label)); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button(entry.label)); expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(button("确认付费生成独立堕落之影").disabled).toBe(true);
  });

  it("retains a submitted spawn through save failure and never treats the creature as locally created", async () => {
    const entry = spawn(), value = trained({ actions: [entry] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(entry.label)); await userEvent.click(screen.getByRole("checkbox")); fireEvent.click(button("确认付费生成独立堕落之影"));
    rerender(<BlackKnightPanel blackKnight={value} resources={resources} busy={false} error="保存失败" onCommand={onCommand} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true); expect(button("暂不生成堕落之影").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "同一独立堕落之影与原房间" }).textContent).toContain("没有生成生物");
    rerender(update(value, onCommand)); fireEvent.click(button("确认付费生成独立堕落之影")); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("invalidates an unsubmitted review when committed original shade facts change", async () => {
    const entry = spawn(), value = trained({ actions: [entry] }), { onCommand, rerender } = panel(value); await userEvent.click(button(entry.label)); await userEvent.click(screen.getByRole("checkbox"));
    rerender(update(trained({ actions: [{ ...entry, enabled: false, reason: "同一原房间已隔离。" }], shade: shade({ status: "ISOLATED", creature: "同一BK4-SHADE-1仍在原房间内。" }) }), onCommand));
    expect(screen.queryByRole("region", { name: "生成独立堕落之影的明确确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows a real failed capture, consumed seals and an available zero-AP ordinary exit", async () => {
    const capture = action({ type: "CAPTURE_SHADE" }, "再次付费捕获同一阴影", false, "1行动 · 3灵性 · 1原封条", "两张原封条均已耗尽。");
    const exit = action({ type: "SHADOW_EXIT" }, "普通走出并耗应急封条", true, "0行动 · 普通走2米 · 消耗BK4-EXIT-SEAL-1");
    const original = shade({ status: "LOOSE", room: "BK4-LAMP-1已熄，原玻璃罩BROKEN，原房间OCCUPIED。", creature: "同一BK4-SHADE-1自主走1米至INNER_DOOR，不挡普通EXIT。",
      kit: "两张BK4-SEAL-1/2已实际耗尽；唯一BK4-EXIT-SEAL-1仍在手。", cost: "已付两次捕获成本，各3灵性、1封条；失败精神−3保留。" });
    const value = trained({ insideCase: true, shade: original, actions: [capture, exit] }), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "同一独立堕落之影与原房间" });
    for (const text of [original.room, original.creature, original.kit, original.cost]) expect(facts.textContent).toContain(text);
    expect(button(capture.label).disabled).toBe(true); expect(button(exit.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "黑骑士成长下一步" }).textContent).toContain(exit.label);
    await userEvent.click(button(exit.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(exit.command); expect(value).toEqual(before);
    expect(facts.textContent).toContain("LOOSE");
  });

  it("keeps a blocked ordinary exit disabled instead of inventing teleportation", () => {
    const exit = action({ type: "SHADOW_EXIT" }, "尝试沿原普通门退出", false, "0行动 · 原门路线", "原普通门BLOCKED，不能瞬移穿门。");
    const { onCommand } = panel(trained({ insideCase: true, shade: shade({ status: "LOOSE", route: "本人ROOM，原普通门BLOCKED。" }), actions: [exit] }));
    expect(button(exit.label).disabled).toBe(true); expect(screen.getByText(exit.reason!)).toBeTruthy(); fireEvent.click(button(exit.label)); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the captured creature in the same cask and requires actual walk before handoff", async () => {
    const back = action({ type: "RETURN_SHADE_ROUTE" }, "携同一封匣普通走出2米", true, "0行动 · 普通路线");
    const handoff = action({ type: "HANDOFF_SHADE" }, "把同一封匣交给门外导师", false, "0行动", "先携原匣实际走到门外。");
    const sealed = shade({ status: "SEALED", creature: "同一BK4-SHADE-1仍活着，已封入同一BK4-CASK-1；未消失。", kit: "原封匣SEALED在PLAYER，第一张封条已耗。" });
    const value = trained({ insideCase: true, shade: sealed, actions: [back, handoff] }), before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(button(handoff.label).disabled).toBe(true); await userEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    const walked = trained({ insideCase: true, shade: { ...sealed, route: "本人OUTSIDE，已实际往返4米，导师就在原门外。" }, actions: [{ ...handoff, enabled: true, reason: null }] });
    rerender(update(walked, onCommand)); await userEvent.click(button(handoff.label)); expect(onCommand.mock.calls[1]![0]).toBe(handoff.command);
    expect(screen.getByRole("region", { name: "同一独立堕落之影与原房间" }).textContent).toContain("仍活着");
  });

  it.each(["ISOLATED", "TAKEN_AWAY"] as const)("renders the same saved creature in terminal state %s without respawn or free cleanup", status => {
    const original = shade(status === "ISOLATED" ? { status, room: "原房间永久QUARANTINED，原门SEALED，原灯仍熄。", creature: "BK4-SHADE-1仍在原INNER_DOOR独立存在。",
      kit: "唯一BK4-EXIT-SEAL-1已实际耗用。", route: "本人OUTSIDE，已普通走出2米。" }
      : { status, room: "原房间CLEARED，原灯仍熄，原玻璃罩破损保留。", creature: "同一BK4-SHADE-1仍在BK4-CASK-1内，被导师带到BK4-STORE。", route: "本人OUTSIDE，已实际走路并交接1次。" });
    panel(trained({ shade: original })); const facts = screen.getByRole("region", { name: "同一独立堕落之影与原房间" });
    expect(facts.textContent).toContain(original.creature); expect(facts.textContent).toContain(original.room);
    expect(screen.queryByRole("button", { name: /生成|复原|重新捕获|命令阴影/ })).toBeNull();
  });
});

describe("Black Knight original encounter and S5 read-only history", () => {
  it("reviews real combat separately, preserving source and death risk before dispatch", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原加里克真实冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); const review = screen.getByRole("region", { name: "黑骑士真实迎战确认" });
    for (const text of ["加里克·诺尔", "4米", "40", "无追逐", "原普通出口", "重伤或死亡", "并非必杀", "当前选中1灵", "不能自动捕获败者"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("确认风险，开始真实交战")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(value).toEqual(before);
  });

  it("shows truthful original enemy terminal health, mind and finite spirituality", async () => {
    const original = encounter({ status: "RESOLVED", enemyHealth: 0, enemyMind: 86, enemySpirituality: 12, enemyStatus: "DEAD", powerUses: { ARC_BOLT: 5, WARD: 1 },
      terminal: { outcome: "ENEMY_DEAD", round: 4, historyIndex: 7, enemyHealth: 0, enemyMind: 86, enemySpirituality: 12, enemyStatus: "DEAD" } });
    const value = trained({ encounter: original }), before = structuredClone(value); panel(value);
    const facts = screen.getByRole("region", { name: "黑骑士原敌人与有限资源" });
    for (const text of ["BK4-GARRICK-NOLL", "0 / 86", "12 / 40", "原加里克死亡", "不补满或重生"]) expect(facts.textContent).toContain(text);
    await userEvent.click(screen.getByText("原敌人实际能力与本人战斗边界")); expect(facts.textContent).toContain(BLACK_KNIGHT_ENCOUNTER_STORY);
    expect(facts.textContent).toContain("已实际使用5次"); expect(value).toEqual(before);
  });

  it("exports original Shepherd stories, soul release, reserve and consumed bottles as read-only history", async () => {
    const original: ShepherdProjection = { title: "原牧羊人经历", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原牧羊人独立渠道记录。", story: "伊森与文森原故事仍保留。", actions: [], abilities: [{ id: "hanged-man.s5.borrowed-arts", label: "原借法", mastery: 16, description: "只来自原实际选择。" }],
      bottles: [{ id: "shepherd-potion-1", title: "第一原瓶", source: "原牧羊人渠道", status: "第56周已实际耗用", chance: 70, command: { type: "CONSUME", bottleId: "shepherd-potion-1", confirmed: true } }],
      acting: 100, digestion: "原牧羊人已消化。", pollution: 3, risk: "原服药记录。", cases: [{ id: "paper-guidance", title: "原纸两米牵引", story: "同一SH5-PAPER-1原故事。",
        status: "RESOLVED", observations: ["原纸不是复制品。"], preparation: "实际借用原伊芮斯。", result: "原纸已真实取回。", contactOpen: "原接触已结束", closes: 2 }],
      insideCase: false, environment: "原牧羊人净空庭院。", grazing: grazing(), reserve: reserve(),
      practice: { paper: "同一SH5-PAPER-1在原桌。", chorus: "原声音已结束。", note: "同一SH5-NOTE-1已交还。", position: "本人原桌前。", history: ["原失败成本保留，没有补偿。"] } };
    const before = structuredClone(original); render(<BlackKnightShepherdHistory shepherd={original} />);
    expect(screen.queryByRole("button")).toBeNull(); const roster = screen.getByRole("region", { name: "牧羊人原灵魂名册与释放记录" });
    for (const text of ["SH5-IRIS-1", "SH5-CEDRIC-1", "当前实际驱使：伊芮斯", "已永久释放", "释放周：64", "轻触术", "勇气歌声"]) expect(roster.textContent).toContain(text);
    await userEvent.click(screen.getByText("同一血肉储备与原包去向")); expect(screen.getByText("血肉储备 1 / 3")).toBeTruthy(); expect(screen.getByText(/原包：RB6-packet-1/)).toBeTruthy();
    await userEvent.click(screen.getByText("原纸两米牵引 · 已提交有限报告")); expect(screen.getByText("当时的实际结果与报告：原纸已真实取回。")).toBeTruthy();
    await userEvent.click(screen.getByText("牧羊人原瓶 · 来源与去向")); expect(screen.getByText("原瓶：shepherd-potion-1")).toBeTruthy();
    await userEvent.click(screen.getByText("牧羊人原能力与故事")); expect(screen.getByText("原借法 · 掌握 16：只来自原实际选择。")).toBeTruthy();
    expect(screen.getByText(original.story!)).toBeTruthy(); expect(original).toEqual(before);
  });
});
