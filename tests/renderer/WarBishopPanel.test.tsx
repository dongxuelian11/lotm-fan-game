/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WarBishopPanel, type WarBishopPanelProps } from "../../src/renderer/WarBishopPanel";
import type { WarBishopAction, WarBishopCommand, WarBishopProjection } from "../../src/domain/war-bishop/types";
import { WAR_BISHOP_CONSUMPTION_RISK } from "../../src/domain/war-bishop/content";

function action(command: WarBishopCommand, label: string, cost = "0行动", extra: Partial<WarBishopAction> = {}): WarBishopAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取战争主教专业指导", "1行动 · 500便士");
const consume = (bottleId = "war-bishop-potion-1") => action({ type: "CONSUME", bottleId, confirmed: true }, `核对并服用${bottleId}`, "0行动 · 消耗这一原瓶");

/** Renderer-only public fixture, never evidence of a natural playthrough or qualification. */
function projection(extra: Partial<WarBishopProjection> = {}): WarBishopProjection {
  return {
    title: "战争主教3 · 原队有限协作", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "已核原文只支持实际编队协作，全部本场数值与情境为G。",
    supplies: "原索伦独立序列3成品三瓶；每瓶6200便士，五次实际劳动后800便士。补货须真实下一周。",
    actions: [guidance()], bottles: [1, 2, 3].map(number => ({ id: `war-bishop-potion-${number}`, title: `战争主教第${number}独立原瓶`,
      source: `索伦独立序列3批次第${number}瓶，原封签WB3-SEAL-${number}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `war-bishop-potion-${number}`, confirmed: true as const } })),
    preparations: [
      { taskId: "INSPECT_ROUTE", title: "亲自踏查原场撤离路线", completedWeek: 115 },
      { taskId: "CHECK_EQUIPMENT", title: "实际清点原场检查器材", completedWeek: 116 },
      { taskId: "PLAN_SUPPORT", title: "实际演练中止与求助安排", completedWeek: 116 },
    ],
    preparedWeek: 119,
    abilities: [
      { id: "hunter.s3.formation-link", label: "有限编队血铁联系", mastery: 0, description: "实际在场原成员各自受力，5灵性与每位2精力G。" },
      { id: "hunter.s3.coordinated-action", label: "原成员协同执行", mastery: 0, description: "真实站位、可见信号、普通交接，不汇集为本人的力量。" },
    ],
    acting: 0, digestion: "铁血骑士消化100，晋4后已经过12/12真实整周。", pollution: 3, risk: WAR_BISHOP_CONSUMPTION_RISK,
    resources: { health: 83, maxHealth: 100, mind: 77, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "MALE", originalGender: "FEMALE",
    inheritedHistory: ["原铁血消化100；猎人9至铁血骑士4原ID掌握全部保留。", "原三十人全部保留，艾达与本尼特原H99、原G1精力18。", "原加里克已投降H60，原棍IB4-GARRICK-CLUB仍归他并留原院。"],
    life: life(), encounter: encounter(), insideCase: false,
    environment: "同一原院，普通生活入口继续；没有复制原人、免费疗伤或天气权柄。",
    ...extra,
  };
}

function life(): WarBishopProjection["life"] {
  return {
    title: "原五位成员的不同分工", source: "原三十人G1引用，不新建成员身体", environment: "每案25，三案后反思25；普通完成也可消化，实际成功能力才有掌握。",
    insideCase: false, reflected: false, invitationWeeks: [],
    practice: {
      activeCase: null, ownerNode: "NEAR", memberNodes: [], linkedMemberIds: [], elapsedSeconds: 0, linkRemainingSeconds: 0,
      frame: { id: "WB3-FRAME-1", source: "原货栈借出唯一搬运框", holder: "RACK", cargo: "SEALED" },
      card: { id: "WB3-CARD-1", source: "原院登记的唯一通行牌", holder: "RACK" },
      load: { id: "WB3-LOAD-1", source: "原训练机械施加预告侧向力", holder: "RACK", phase: "IDLE" },
    },
    members: ["艾达", "本尼特", "克拉拉", "德里克", "艾琳"].map((name, index) => ({ id: `IB4-0${index + 1}`, name,
      health: index < 2 ? 99 : 100, energy: 18, willing: true, present: false, location: "HOME" as const, eligible: true, node: null })),
    cases: ([
      { id: "glass-cart", title: "碎玻璃车", story: "五人分点承持原搬运框，玻璃沿3米路送至远端；普通分两趟。" },
      { id: "fork-signals", title: "信号与岔口", story: "原五人分近中远站位，实际交接同一通行牌；普通叫停核对。" },
      { id: "lateral-load", title: "固定侧向负载", story: "原训练机械给出预告侧向力，五人支撑三点；普通卸载并退回。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
      contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}

function encounter(): WarBishopProjection["encounter"] {
  return {
    title: "新原塞德里克的通行争议", story: "成年塞德里克持自己的原棍挡路；普通出口净空，可和平离开。", status: "AVAILABLE",
    enemy: { id: "WB3-CEDRIC-VALE", name: "塞德里克·维尔", age: 42, sequence: 3, health: 91, mind: 88, spirituality: 103,
      status: "RESISTING", weaponId: "WB3-CEDRIC-CLUB", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 3, COMPOSE: 0 } },
    companions: [], linkedMemberIds: [], policy: "HOLD", inside: false, actions: [],
    facts: ["本次有限G3等效，不冒称原著新途径模板。", "原五人须本次重新受邀；条件不足不耗5灵性或每人2精力。", "普通出口净空，无追逐；不治疗、不补满灵性。"],
  };
}

function panel(value = projection(), props: Partial<Omit<WarBishopPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<WarBishopPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
async function open(text: string) { await userEvent.click(screen.getByText(text, { selector: "summary" })); }
afterEach(cleanup);

describe("WarBishopPanel original people, finite cooperation and committed intent", () => {
  it("leads with the current gate and never exposes invented recipe ingredients", () => {
    const reason = "晋4后尚只有11/12整周，须真实下一周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应显示的假材料", quantity: 8, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "战争主教当前目标" }).textContent).toContain(reason);
    expect(button("听取战争主教专业指导").disabled).toBe(true);
    expect(button("听取战争主教专业指导").getAttribute("aria-describedby")).toContain("war-bishop-reason-");
    fireEvent.click(button("听取战争主教专业指导")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByText("不应显示的假材料")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps old records and unknown recipe boundaries in genuinely closed native details", async () => {
    const { onCommand } = panel();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "战争主教3 · 原队有限协作" }));
    for (const label of ["独立成品、专业准备与配方边界", "原身体、三十人历史与继承能力", "当前资源与场地说明"]) expect(fold(label).open).toBe(false);
    // jsdom may expose closed details descendants to roles; assert the real open property.
    await open("独立成品、专业准备与配方边界"); expect(fold("独立成品、专业准备与配方边界").open).toBe(true);
    const boundary = screen.getByRole("region", { name: "战争主教成品与配方边界" });
    for (const text of ["完整配方", "仍未知", "本作G", "不使用序列0", "6200", "800", "第115周"]) expect(boundary.textContent).toContain(text);
    expect(within(boundary).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("submits a typed ordinary action once and waits for changed committed facts", () => {
    const value = projection(), before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button("听取战争主教专业指导")); fireEvent.click(button("听取战争主教专业指导"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
    expect(screen.getByRole("status").textContent).toContain("正在结算并保存");
    const nextCommand: WarBishopCommand = { type: "PREPARE_TASK", taskId: "INSPECT_ROUTE" };
    rerender(<WarBishopPanel {...defaults} value={{ ...value, actions: [action(nextCommand, "实际踏查原路", "1行动")] }} />);
    fireEvent.click(button("实际踏查原路")); expect(onCommand).toHaveBeenNthCalledWith(2, nextCommand);
  });

  it.each(["busy", "blocked"] as const)("locks all mutations and page dismissal while %s", flag => {
    const { onCommand, onClose } = panel(projection(), { [flag]: true });
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) { expect(control.disabled).toBe(true); fireEvent.click(control); }
    expect((screen.getByRole("combobox", { name: "选择独立战争主教原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("shows only saved resource values, without filling current spirituality to its cap", async () => {
    panel(); await open("当前资源与场地说明");
    const resources = screen.getByRole("region", { name: "战争主教当前资源" });
    for (const text of ["83 / 100", "77 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(resources.textContent).not.toContain("120 / 120");
  });

  it("selects one original bottle and forwards its actual labour command without touching another", async () => {
    const commands: WarBishopCommand[] = [{ type: "POTION_WORK", bottleId: "war-bishop-potion-1" }, { type: "POTION_WORK", bottleId: "war-bishop-potion-2" }];
    const value = projection({ actions: commands.map((command, index) => action(command, `第${index + 1}瓶实际劳动`, "1行动 · 本瓶劳务")) }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立战争主教原瓶" }), "war-bishop-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶实际劳动/ })).toBeNull(); fireEvent.click(button("第2瓶实际劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it("reviews one genuine original with risk and continuity, without a second body-change consent", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "战争主教原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "战争主教第1独立原瓶" }));
    for (const text of ["war-bishop-potion-1", "WB3-SEAL-1", "71%", "第119周", "本渠道仅提供独立成品，晋升仍须完成专业准备", "身体性别不再变化", "首次服药前：女性", "当前角色身体：男性", "当前灵性不补满", "成功或失败", "普通死亡"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("WB3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button("暂不服用")); expect(document.activeElement).toBe(button("核对并服用"));
  });

  it("Escape cancels only unsubmitted review and returns focus without leaving any real preparation", async () => {
    const value = projection({ actions: [consume()] }), before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "战争主教原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("submits the exact already-reviewed consume intent once without adding body-change flags", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const confirm = button("确认服用这一原瓶"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "war-bishop-potion-1", confirmed: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(confirm.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "战争主教原瓶服用确认" })).toBeTruthy();
  });

  it("invalidates a review when saved costs, resources or original bottle facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    const changed = { ...value, actions: [{ ...consume(), cost: "新增实际成本" }] };
    rerender(<WarBishopPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "战争主教原瓶服用确认" })).toBeNull();
    await userEvent.click(button("核对并服用"));
    rerender(<WarBishopPanel {...defaults} value={{ ...changed, preparedWeek: null }} />); expect(screen.queryByRole("region", { name: "战争主教原瓶服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with the current authoritative reason", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<WarBishopPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "本次场地仍有未归还原物。" }] }} />);
    const confirm = button("确认服用这一原瓶"); expect(confirm.disabled).toBe(true); expect(confirm.getAttribute("aria-describedby")).toBe("war-bishop-confirm-reason");
    expect(screen.getByRole("region", { name: "战争主教原瓶服用确认" }).textContent).toContain("未归还原物"); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it("holds the submitted original intent through save failure for the outer retry control", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    rerender(<WarBishopPanel {...defaults} error={{ message: "原服药保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("上次已保存的记录"); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<WarBishopPanel {...defaults} value={structuredClone(value)} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true); fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("directs a nonretryable error to reload without sending a replacement command", () => {
    const { onCommand, onClose } = panel(projection(), { error: { message: "版本冲突", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(button("听取战争主教专业指导")); fireEvent.click(button("关闭战争主教页面")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("shows original G1 health, fatigue and consent without turning its historical roster into arrivals", async () => {
    const value = projection({ promoted: true, actions: [] }); value.life.members[1]!.willing = false; value.life.members[1]!.eligible = false; value.life.members[1]!.energy = 3;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "战争主教当前目标" }).textContent).toContain("实际在院 0 / 5");
    await open("原G1五人的当前状态 · 实际在院 0 / 5"); const people = screen.getByRole("region", { name: "原G1真实成员状态" });
    for (const text of ["IB4-01", "IB4-05", "健康 99 / 100", "精力 3 / 20", "当前未同意合作", "在家中，尚未到场", "伤势和疲劳仍保留"]) expect(people.textContent).toContain(text);
    expect(people.textContent).not.toContain("IB4-06"); expect(within(people).queryByRole("button")).toBeNull(); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects one current story while preserving three distinct ordinary routes and original objects", async () => {
    const value = projection({ promoted: true, actions: [] }), { onCommand } = panel(value);
    await open("三个不同生活情境与实际失败记录"); const records = screen.getByRole("region", { name: "战争主教生活记录" });
    for (const text of ["碎玻璃车", "普通分两趟", "信号与岔口", "普通叫停核对", "固定侧向负载", "普通卸载并退回"]) expect(records.textContent).toContain(text);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择战争主教生活情境" }), "fork-signals");
    expect(screen.getByRole("region", { name: "当前战争主教生活情境" }).textContent).toContain("信号与岔口");
    await open("同一原物与有限联系"); const originals = screen.getByRole("region", { name: "战争主教原物与联系" });
    for (const text of ["WB3-FRAME-1", "WB3-CARD-1", "WB3-LOAD-1", "开启联系5灵性", "每位实际参与者2精力", "60秒与6米", "原架"]) expect(originals.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses the saved active case and positions rather than a local selection, with no synthetic reset on close", async () => {
    const value = projection({ promoted: true, insideCase: true, actions: [] });
    value.life.insideCase = true; value.life.practice.activeCase = "lateral-load"; value.life.practice.ownerNode = "FAR";
    value.life.practice.elapsedSeconds = 20; value.life.practice.linkRemainingSeconds = 40; value.life.practice.linkedMemberIds = value.life.members.map(member => member.id);
    value.life.members.forEach(member => { member.present = true; member.location = "YARD"; member.eligible = false; member.node = "FAR"; });
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const current = screen.getByRole("region", { name: "当前战争主教生活情境" });
    for (const text of ["固定侧向负载", "本人在原远端", "实际经过 20 秒", "停止不退还成本"]) expect(current.textContent).toContain(text);
    await open("三个不同生活情境与实际失败记录"); expect((screen.getByRole("combobox", { name: "选择战争主教生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("关闭战争主教页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps inherited body and thirty-person growth history read-only alongside new ability limits", async () => {
    const value = projection({ promoted: true, actions: [] }), { onCommand } = panel(value);
    await open("原身体、三十人历史与继承能力"); const history = screen.getByRole("region", { name: "战争主教继承记录" });
    for (const text of ["原铁血消化100", "三十人全部保留", "原加里克已投降H60", "本阶不再次改变性别"]) expect(history.textContent).toContain(text);
    const powers = screen.getByRole("region", { name: "战争主教能力边界" });
    for (const text of ["有限编队血铁联系", "原成员协同执行", "掌握 0", "战斗默认保留联系", "条件不足不耗", "没有免费独立轮盘"]) expect(powers.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("exposes actual failed work and individual costs while preserving the ordinary return command", () => {
    const returnCommand: WarBishopCommand = { type: "RETURN_NEAR" };
    const link = action({ type: "START_LINK" }, "联结本次原五人", "5灵性 · 每人2精力", { enabled: false, reason: "本次已失败，先普通返回；不重复耗灵。" });
    const value = projection({ promoted: true, insideCase: true, actions: [link, action(returnCommand, "沿普通路退回近端", "0行动 · 10秒")] });
    value.life.insideCase = true; value.life.practice.activeCase = "glass-cart"; value.life.practice.ownerNode = "FAR";
    value.life.cases[0]!.attempts = [{ invitedWeek: 121, initialCargo: "SEALED", method: "ABILITY", result: "NONE", performed: true, closed: false, returned: false, dismissed: false,
      failed: true, linkStarted: true, abilityAttempted: true, elapsedSeconds: 20, linkedSeconds: 15, toolTravelMetres: 3, completedTrips: 0,
      signalStage: 0, signalChecked: false, loadSupported: false, loadReleased: false, ownerDamage: 1,
      memberCosts: [{ id: "IB4-01", healthLoss: 1, energySpent: 3 }, { id: "IB4-02", healthLoss: 1, energySpent: 3 }] }];
    const before = structuredClone(value), { onCommand } = panel(value); const failure = screen.getByRole("region", { name: "本次实践失败与实际代价" });
    for (const text of ["本次实际失败", "第121周", "本人健康损失 1", "艾达（IB4-01）健康−1、精力−3", "本次已开启联系并耗5灵性", "尚未散场"]) expect(failure.textContent).toContain(text);
    expect(button("联结本次原五人").disabled).toBe(true); fireEvent.click(button("联结本次原五人")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("沿普通路退回近端")); fireEvent.click(button("沿普通路退回近端")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(returnCommand); expect(value).toEqual(before);
  });

  it("opens the current original-person encounter with genuine resources and a direct peaceful exit", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿普通出口和平离开", "0行动 · 原同伴实际返家");
    const value = projection({ promoted: true, actions: [leave] }); value.encounter = { ...encounter(), inside: true, status: "READY", actions: [leave] };
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(true);
    expect(screen.getByRole("region", { name: "战争主教当前目标" }).textContent).toContain("沿普通出口和平离开");
    const scene = screen.getByRole("region", { name: "战争主教原人遭遇" });
    for (const text of ["塞德里克·维尔", "42岁", "WB3-CEDRIC-VALE", "WB3-CEDRIC-CLUB", "健康 91", "独立灵性 103", "保留，不自动施术", "普通出口净空", "条件不足不耗"]) expect(scene.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前战争主教生活情境" })).toBeNull();
    fireEvent.click(button("沿普通出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });
});
