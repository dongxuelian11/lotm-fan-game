/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeceitMentorPanel, type DeceitMentorPanelProps } from "../../src/renderer/DeceitMentorPanel";
import type { DeceitMentorAction, DeceitMentorCommand, DeceitMentorProjection } from "../../src/domain/deceit-mentor/types";
import { DECEIT_MENTOR_CONSUMPTION_RISK, DECEIT_MENTOR_FORMULA_STATUS, DECEIT_MENTOR_SOURCE_STATUS } from "../../src/domain/deceit-mentor/content";
import { createDeceitMentorLifeState } from "../../src/domain/deceit-mentor/life";

type Attempt = NonNullable<DeceitMentorProjection["life"]["currentAttempt"]>;
type CaseId = DeceitMentorProjection["life"]["cases"][number]["id"];
function action(command: DeceitMentorCommand, label: string, cost = "0行动", extra: Partial<DeceitMentorAction> = {}): DeceitMentorAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取欺瞒导师专业指导", "1行动 · 500便士");
const consume = (id = "deceit-mentor-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
// These are explicit public UI fixtures, not natural RNG results, campaign evidence or domain eligibility claims.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 105, method: "ABILITY", closed: false, result: "NONE", initialSpirituality: 42, initialMind: 90,
    elapsedSeconds: 0, playerTravelMetres: 0, witnessTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, abilityTier: null,
    ownerConsent: "UNASKED", ownerConsentWeek: null, witnessConsent: "UNASKED", witnessConsentWeek: null,
    itemTaken: false, siteVisited: false, stopped: false, effectStopped: false, inspected: false, playerReturned: false, itemReturned: false,
    lampLit: false, lampOilSpent: 0, candleSpent: 0, plateRead: false, plateReadBy: null, extinguished: false,
    tagReleased: false, tagRead: false, tagReadWhile: null, tagRecovered: false,
    cardPlaced: false, cardRead: false, originalFace: null, observedFaceBeforeCorrection: null, cardFlipped: false,
    correctedOriginalFace: null, verifiedFace: null, correctionMade: false, cardRecovered: false, witnessReturned: false, ...extra };
}
function life(): DeceitMentorProjection["life"] {
  return { ...createDeceitMentorLifeState(), title: "欺瞒导师有限规则欺瞒G", story: "三项原创G原物实践", environment: "原工坊与普通干廊。",
    nextStep: "先当面取得本案原主许可。", inside: false, insideCase: false, currentAttempt: null, actions: [],
    cases: ([
      { id: "spent-lamp", title: "同一原灯与有限续光", story: "携同一原灯实际往返6米，只用原油与原备用蜡烛。" },
      { id: "falling-tag", title: "同一原纸签与有限迟落", story: "原签在同一原毡盘上方短暂迟落，再实际收回。" },
      { id: "witness-correction", title: "原卡误判与现场纠正", story: "当时判断与纠正分别保存，原人各自实际返程。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): DeceitMentorProjection["encounter"] {
  return { title: "原干院与独立的吉迪恩", story: "2米净空原院与独立原创G对手，普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    scene: { courtId: "DM3-COURT", ground: "DRY", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: "ORIGIN" },
    enemy: { id: "DM3-GIDEON", name: "吉迪恩·哈特", age: 47, source: "ORIGINAL_LIMITED_G", sequence: 3,
      health: 80, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "DM3-GIDEON-ROD", weaponLocation: "HAND", powerUses: { FORCE_STRIKE: 1, GUARD: 2, DISCERN: 1 } },
    actions: [], facts: ["当前无第三人；所有原资源按保存结果显示。", "本轮辨伪只抵下一次成功欺瞒，被抵仍实耗灵性。"] };
}
function projection(extra: Partial<DeceitMentorProjection> = {}): DeceitMentorProjection {
  return { title: "欺瞒导师·错误序列3（有限规则欺瞒G）", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "已核方向与原创G有限场景。", supplies: "三独立原瓶6400便士，或各五次真实劳务后900便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `deceit-mentor-potion-${n}`, title: `欺瞒导师第${n}独立原瓶`,
      source: `独立原瓶封签DM3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `deceit-mentor-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_SOURCE", title: "核对来源", completedWeek: 98 }, { taskId: "BOUND_EFFECT", title: "核对时限", completedWeek: 99 },
      { taskId: "PLAN_RESTITUTION", title: "核对返还", completedWeek: 100 }], preparedWeek: 104,
    abilities: [{ id: "error.s3.law-deceit", label: "规则欺瞒（有限作用G）", mastery: 0, description: "原灯续光与原纸签迟落均有有限时长。" },
      { id: "error.s3.deep-deception", label: "深层欺瞒（有限注意偏移G）", mastery: 0, description: "只影响本次原卡判断，停效后现场纠正。" }],
    acting: 0, digestion: "原寄生者消化100，从第82周晋升已满12整周。", pollution: 3, risk: DECEIT_MENTOR_CONSUMPTION_RISK,
    resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    currentGender: "FEMALE", inheritedHistory: ["原托马斯两次分离，宿主继续自主。", "原艾莉丝坐下念头已执行并恢复。", "旧拉尔夫W91重伤投降，原棍留原庭院。", "原暂窃失败，实际没有能力入库。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原工坊与原干院，普通出口真实开放。", ...extra };
}
function activate(value: DeceitMentorProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<DeceitMentorPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<DeceitMentorPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("DeceitMentorPanel saved original objects, finite effects and explicit confirmation", () => {
  it("puts current readiness and real resources first, folds secondary facts and hides unknown recipe material", () => {
    const reason = "原寄生者只有11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应显示的猜测材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "欺瞒导师当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取欺瞒导师专业指导").disabled).toBe(true);
    expect(button("听取欺瞒导师专业指导").getAttribute("aria-describedby")).toContain("deceit-mentor-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原身体、旧寄生与继承原物", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("不应显示的猜测材料")).toBeNull(); fireEvent.click(button("听取欺瞒导师专业指导"));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps independent preparation and finite effect limits without importing Wanderer provenance", async () => {
    panel();
    expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain("序列2命运木马及以上的能力不随本阶晋升直接获得");
    await open("独立成品与晋升准备");
    const recipe = screen.getByRole("region", { name: "欺瞒导师成品与配方边界" });
    for (const text of ["材料、用量、调配顺序和完整仪式保持未知", "不开放自制配方", "DM3-ADRIAN", "54岁", "6400", "900便士", "500便士", "140便士", "12整周", "第104周", "独立成品渠道与专业指导", "三项准备各1行动"]) expect(recipe.textContent).toContain(text);
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "欺瞒导师能力与使用范围" });
    for (const text of ["旧寄生者4", "16秒", "8秒", "6秒", "通用重力控制", "天使分身", "主辅颠倒", "源堡复活骗局", "普通方法完成", "失败与取消均不赠能力掌握", "不会回填原油", "复制原物", "增加该能力掌握8"]) expect(scope.textContent).toContain(text);
    expect(screen.queryByText(/DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER/)).toBeNull();
  });

  it("adapts direct authored formula and source paragraphs without mutating committed fixtures", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    const recipe = screen.getByRole("region", { name: "欺瞒导师成品与配方边界" });
    expect(within(recipe).getByText("欺瞒导师是错误途径序列3，能够深化骗术并有限欺瞒自然规律；完整配方尚未掌握，服用前需要专业准备。材料、用量、调配顺序和完整仪式保持未知，仍须完成服药准备。本阶段只采用独立成品渠道与专业指导；三项准备和当次场地检查均须实际完成，不开放自制配方。")).toBeTruthy();
    expect(within(recipe).queryByText(DECEIT_MENTOR_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "欺瞒导师能力与使用范围" });
    expect(within(scope).getByText("欺瞒导师序列3能够有限欺瞒自然规律，并深化诈骗师能力；效果持续时间受当前方法和条件限制。当前渠道只提供成品魔药，晋升仍须准备；寄生和能力窃取沿用旧寄生者4的容量，不获得天使分身。以下无油续光16秒、同一轻纸签迟落8秒、同一原卡朝向误判最多6秒及所有具体场地、动作和数值均以当前说明为准，不获得通用重力控制。序列2命运木马、换命、主辅颠倒、源堡复活骗局均不下放。")).toBeTruthy();
    expect(within(scope).queryByText(DECEIT_MENTOR_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the original natural Error prefix and all inherited people and failed theft read-only", async () => {
    const value = projection(), before = structuredClone(value); panel(value); await open("原身体、旧寄生与继承原物");
    const history = screen.getByRole("region", { name: "欺瞒导师继承记录" });
    for (const text of ["女性", "普通人自然周目前缀", "原托马斯两次分离", "原艾莉丝", "旧拉尔夫W91", "原棍留原庭院", "没有能力入库", "不赠天使能力"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects an independent original bottle and forwards only its exact command once", async () => {
    const commands: DeceitMentorCommand[] = [{ type: "POTION_WORK", bottleId: "deceit-mentor-potion-1" }, { type: "POTION_WORK", bottleId: "deceit-mentor-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}原瓶劳动`, "1行动")) });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立欺瞒导师原瓶" }), "deceit-mentor-potion-2");
    expect(screen.queryByRole("button", { name: /^第1原瓶劳动/ })).toBeNull();
    fireEvent.click(button("第2原瓶劳动")); fireEvent.click(button("第2原瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews the chosen original dose and four real outcomes, then Escape cancels and restores focus", async () => {
    const { onCommand, onClose } = panel(projection({ actions: [consume()] }));
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "欺瞒导师原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "欺瞒导师第1独立原瓶" }));
    for (const text of ["deceit-mentor-potion-1", "DM3-SEAL-1", "71%", "第104周", "0行动", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "成功或失败", "性别不改变", "当前灵性不补满"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("DM3-SEAL-2"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "欺瞒导师原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits confirmed:true once and keeps the same original intent locked through a failed save", async () => {
    const value = projection({ actions: [consume()] }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "deceit-mentor-potion-1", confirmed: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before);
    rerender(<DeceitMentorPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "欺瞒导师原瓶服用确认" })).toBeTruthy();
    rerender(<DeceitMentorPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<DeceitMentorPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "欺瞒导师原瓶服用确认" })).toBeNull(); expect(button("关闭欺瞒导师页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("never submits or closes while locked: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    fireEvent.click(button("听取欺瞒导师专业指导")); fireEvent.click(button("关闭欺瞒导师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取欺瞒导师专业指导").disabled).toBe(true);
  });

  it("invalidates an unsubmitted original-dose review when committed resources or eligibility change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40;
    changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<DeceitMentorPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "欺瞒导师原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("places one primary action before physical facts and locks actual active-case selection", () => {
    const command: DeceitMentorCommand = { type: "CONSENT_OWNER", caseId: "spent-lamp" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面问伊迪丝本案许可")] }), "spent-lamp");
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "欺瞒导师原人原物与真实位置" });
    expect(screen.getByRole("region", { name: "欺瞒导师当前行动" }).compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "欺瞒导师下一步" })).getAllByRole("button")).toHaveLength(1);
    expect((screen.getByRole("combobox", { name: "选择欺瞒导师生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    for (const text of ["DM3-WORKSHOP", "DM3-EDITH", "43岁", "DM3-BASIL", "39岁", "DM3-DOOR", "实际开放", "6米", "4米", "10米", "旧案同意不延续"]) expect(scene.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "当前欺瞒导师生活情境" }).textContent).toContain(value.life.nextStep);
    fireEvent.click(button("当面问伊迪丝本案许可")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("lets the player choose an unstarted case without spending an action or opening a scene", async () => {
    const value = projection({ promoted: true, actions: [action({ type: "OBSERVE", caseId: "spent-lamp" }, "观察同一原灯", "1行动"), action({ type: "OBSERVE", caseId: "falling-tag" }, "观察同一原签", "1行动")] });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择欺瞒导师生活情境" }), "falling-tag");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察同一原灯/ })).toBeNull();
    const current = screen.getByRole("region", { name: "当前欺瞒导师生活情境" });
    for (const text of ["准备前须留足2行动", "现场子步0行动", "共13行动"]) expect(current.textContent).toContain(text);
    fireEvent.click(button("观察同一原签")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(value.life.activeCase).toBeNull();
  });

  it("shows remaining original lamp and candle resources without ticking or revealing the unread plate", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "spent-lamp", attempt({ ownerConsent: "GRANTED", witnessConsent: "GRANTED", lampLit: true, lampOilSpent: 1, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    Object.assign(value.life.lamp, { location: "PLAYER", oil: 0, lit: true, wickSeconds: 17, extensionSeconds: 16, extensionUsed: true, travelMetres: 6 });
    value.life.playerLocation = "BENCH"; value.life.clockSeconds = 13; value.life.playerTravelMetres = 6;
    const before = structuredClone(value), { defaults, rerender } = panel(value), lamp = screen.getByRole("region", { name: "欺瞒导师原灯与有限燃料" });
    for (const text of ["DM3-LAMP", "数量 1", "本人随身", "0 / 1 单位", "17 秒", "16 秒", "DM3-CANDLE", "1 / 1 支", "40 秒", "DM3-PLATE", "原试验台BENCH", "尚未核读", "24秒"]) expect(lamp.textContent).toContain(text);
    expect(lamp.closest("details")).toBeNull(); expect(lamp.textContent).not.toContain(value.life.plate.inscription);
    rerender(<DeceitMentorPanel {...defaults} value={structuredClone(value)} />);
    expect(screen.getByRole("region", { name: "欺瞒导师原灯与有限燃料" }).textContent).toContain("17 秒"); expect(value).toEqual(before);
  });

  it("shows failed extension, actually consumed original candle and ordinary reading without fake mastery", async () => {
    const command: DeceitMentorCommand = { type: "RETURN_PLAYER", caseId: "spent-lamp" };
    const value = activate(projection({ promoted: true, actions: [action(command, "携原灯普通6米返回START", "0行动 · 0灵性 · 6米")] }), "spent-lamp",
      attempt({ abilityTier: "FAILURE", spiritualitySpent: 6, lampLit: true, lampOilSpent: 1, candleSpent: 1, plateRead: true, plateReadBy: "CANDLE", extinguished: true, effectStopped: true }));
    Object.assign(value.life.lamp, { location: "PLAYER", oil: 0, lit: false, wickSeconds: 0, extensionSeconds: 0, extensionUsed: true });
    Object.assign(value.life.candle, { remaining: 0, lit: false, burnSeconds: 14 }); value.life.playerLocation = "BENCH";
    const before = structuredClone(value), { onCommand } = panel(value), costs = screen.getByRole("region", { name: "欺瞒导师本次尝试与代价" });
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    for (const text of ["失败", "不能重骰", "已付灵性 6", "原油实耗 1", "原蜡烛实耗 1", "同一原蜡烛", "已实际熄灯"]) expect(costs.textContent).toContain(text);
    const lamp = screen.getByRole("region", { name: "欺瞒导师原灯与有限燃料" });
    for (const text of ["0 / 1 支", "14 秒", "L-17 原工坊灯具", "当前已经熄灭"]) expect(lamp.textContent).toContain(text);
    await open("能力范围与实际掌握"); expect(screen.getByRole("region", { name: "欺瞒导师能力与使用范围" }).textContent).toContain("掌握 0");
    fireEvent.click(button("携原灯普通6米返回START")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("does not synthesize oil, candle or free relighting when original resources are unavailable", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "EXTEND_LIGHT", caseId: "spent-lamp" }, "尝试原灯续光", "6灵性", { enabled: false, reason: "原火已经熄灭，不能用续光重燃。" })] }), "spent-lamp");
    Object.assign(value.life.lamp, { oil: 0, lit: false, wickSeconds: 0, extensionSeconds: 0, extensionUsed: true }); value.life.candle.remaining = 0;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(button("尝试原灯续光").disabled).toBe(true); expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain("原火已经熄灭");
    fireEvent.click(button("尝试原灯续光")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps the same airborne tag and finite countdown visible without reading its number for the player", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "READ_TAG", caseId: "falling-tag" }, "核读空中同一原签", "0行动 · 5秒")] }), "falling-tag",
      attempt({ ownerConsent: "GRANTED", witnessConsent: "GRANTED", itemTaken: true, tagReleased: true, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    Object.assign(value.life.tag, { location: "AIR", delaySeconds: 8, travelMetres: 6 }); value.life.playerLocation = "BENCH";
    const before = structuredClone(value), { onCommand } = panel(value), tag = screen.getByRole("region", { name: "欺瞒导师原签与有限迟落" });
    for (const text of ["DM3-TAG", "数量 1", "原毡托盘上方", "8 秒", "DM3-TRAY", "5秒", "尚未现场核号"]) expect(tag.textContent).toContain(text);
    expect(tag.textContent).not.toContain(value.life.tag.number); expect(tag.closest("details")).toBeNull();
    fireEvent.click(button("核读空中同一原签")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("shows actual landing at the original tray and requires real pickup before any return", () => {
    const command: DeceitMentorCommand = { type: "RECOVER_TAG", caseId: "falling-tag" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手收回同一原签")] }), "falling-tag",
      attempt({ tagReleased: true, tagRead: true, tagReadWhile: "AIR", abilityTier: "SUCCESS", spiritualitySpent: 6, effectStopped: true }));
    Object.assign(value.life.tag, { location: "TRAY", delaySeconds: 0, travelMetres: 6 }); value.life.playerLocation = "BENCH";
    const before = structuredClone(value), { onCommand } = panel(value), tag = screen.getByRole("region", { name: "欺瞒导师原签与有限迟落" });
    for (const text of ["0 秒", "已实际落在同一毡盘", "须到场亲手收回", "T-08"]) expect(tag.textContent).toContain(text);
    fireEvent.click(button("亲手收回同一原签")); fireEvent.click(button("亲手收回同一原签"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before); expect(value.life.tag.location).toBe("TRAY");
  });

  it("shows the earlier wrong impression distinctly from original truth and later corrected current card", () => {
    const command: DeceitMentorCommand = { type: "VERIFY_CARD", caseId: "witness-correction" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面纠正并核对同一原卡")] }), "witness-correction",
      attempt({ cardRead: true, cardPlaced: true, originalFace: "FRONT", observedFaceBeforeCorrection: "BACK", abilityTier: "SUCCESS", spiritualitySpent: 6, cardFlipped: true, effectStopped: true }));
    Object.assign(value.life.card, { location: "FRAME", face: "BACK", deceptionSeconds: 0, travelMetres: 10 });
    value.life.basil.location = "CABINET"; value.life.basil.travelMetres = 4; value.life.playerLocation = "CABINET";
    const before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    let facts = screen.getByRole("region", { name: "欺瞒导师原卡与纠正记录" });
    for (const text of ["DM3-CARD", "数量 1", "DM3-FRAME", "0 秒", "施术前原卡实面：正面（蓝三角）", "当时见证判断：背面（红圆）", "这是当时的误判", "尚未完成当面纠正", "当前真实卡面：背面（红圆）", "尚未实际4米返回BENCH"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button("当面纠正并核对同一原卡")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
    const saved = structuredClone(value); Object.assign(saved.life.currentAttempt!, { correctionMade: true, correctedOriginalFace: "FRONT", verifiedFace: "BACK" }); saved.actions = [];
    rerender(<DeceitMentorPanel {...defaults} value={saved} />); facts = screen.getByRole("region", { name: "欺瞒导师原卡与纠正记录" });
    for (const text of ["当时见证判断：背面（红圆）", "已当面纠正：施术时原面是正面（蓝三角）", "现场核实当前卡面为背面（红圆）", "旧判断保留，未改写原记忆"]) expect(facts.textContent).toContain(text);
  });

  it("shows a witness seeing through the attempted deception without inventing a wrong impression", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "witness-correction", attempt({ cardRead: true, originalFace: "FRONT", observedFaceBeforeCorrection: "FRONT", abilityTier: "FAILURE", spiritualitySpent: 6 }));
    value.life.card.location = "FRAME"; value.life.basil.location = "CABINET"; value.life.playerLocation = "CABINET";
    panel(value); const facts = screen.getByRole("region", { name: "欺瞒导师原卡与纠正记录" });
    expect(facts.textContent).toContain("当时未看错；不能把识破算成能力成功"); expect(facts.textContent).not.toContain("这是当时的误判");
    expect(screen.getByRole("region", { name: "欺瞒导师本次尝试与代价" }).textContent).toContain("已付灵性 6");
  });

  it("keeps the projected stop-effect step primary when waiting is an optional alternative", () => {
    const value = activate(projection({ promoted: true, actions: [
      action({ type: "STOP_EFFECT", caseId: "witness-correction" }, "先停止这次注意偏移"),
      action({ type: "WAIT_EFFECT", caseId: "witness-correction" }, "也可等待剩余时限"),
      action({ type: "STOP_CONTACT", caseId: "witness-correction" }, "停止本次接触"),
    ] }), "witness-correction");
    value.life.card.deceptionSeconds = 4; value.life.nextStep = "下一步：先停止这次注意偏移";
    panel(value);
    expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain("先停止这次注意偏移");
    expect(within(screen.getByRole("group", { name: "欺瞒导师下一步" })).getByRole("button").textContent).toContain("先停止这次注意偏移");
    expect(fold("其它可选方法").open).toBe(false);
  });

  it("shows active card expiry and submits real wait without simulating its end", () => {
    const command: DeceitMentorCommand = { type: "WAIT_EFFECT", caseId: "witness-correction" };
    const value = activate(projection({ promoted: true, actions: [action(command, "等待这次有限偏移到期", "0行动 · 剩余6秒")] }), "witness-correction", attempt({ cardRead: true, originalFace: "FRONT", observedFaceBeforeCorrection: "BACK", abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    Object.assign(value.life.card, { location: "FRAME", deceptionSeconds: 6 }); value.life.playerLocation = "CABINET"; value.life.basil.location = "CABINET";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "欺瞒导师原卡与纠正记录" }).textContent).toContain("当前注意偏移剩余 6 秒");
    fireEvent.click(button("等待这次有限偏移到期")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("requires the original witness's physical 4 metre return and preserves the original card position", () => {
    const command: DeceitMentorCommand = { type: "RETURN_WITNESS", caseId: "witness-correction" };
    const value = activate(projection({ promoted: true, actions: [action(command, "请巴兹尔实际4米返回BENCH", "0行动 · 4秒")] }), "witness-correction",
      attempt({ cardRead: true, originalFace: "FRONT", observedFaceBeforeCorrection: "BACK", correctionMade: true, correctedOriginalFace: "FRONT", verifiedFace: "BACK", effectStopped: true, cardRecovered: true }));
    value.life.playerLocation = "CABINET"; value.life.card.location = "PLAYER"; value.life.basil.location = "CABINET"; value.life.basil.travelMetres = 4;
    const before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button("请巴兹尔实际4米返回BENCH")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
    const saved = structuredClone(value); saved.life.basil.location = "BENCH"; saved.life.basil.travelMetres = 8; saved.life.currentAttempt!.witnessReturned = true; saved.actions = [];
    rerender(<DeceitMentorPanel {...defaults} value={saved} />); const facts = screen.getByRole("region", { name: "欺瞒导师原卡与纠正记录" });
    for (const text of ["已经实际4米返回BENCH", "巴兹尔累计普通行走 8 米", "本人随身"]) expect(facts.textContent).toContain(text);
    expect(saved.life.playerLocation).toBe("CABINET"); expect(saved.life.card.location).toBe("PLAYER");
  });

  it("makes a present refusal visible and submits only the available ordinary stop", () => {
    const command: DeceitMentorCommand = { type: "STOP_CONTACT", caseId: "falling-tag" };
    const value = activate(projection({ promoted: true, actions: [action(command, "停止本次接触")] }), "falling-tag", attempt({ ownerConsent: "GRANTED", witnessConsent: "DECLINED", itemTaken: true }));
    value.life.basil.willing = false; value.life.playerLocation = "BENCH"; value.life.tag.location = "PLAYER";
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "欺瞒导师原人原物与真实位置" });
    for (const text of ["已拒绝本次演练", "不能以随机结果强迫同意", "旧案同意不延续"]) expect(scene.textContent).toContain(text);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); fireEvent.click(button("停止本次接触"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before); expect(value.life.tag.location).toBe("PLAYER");
  });

  it("closes only the view without stopping a live effect, moving people or returning the original item", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "witness-correction");
    value.life.playerLocation = "CABINET"; value.life.card.location = "FRAME"; value.life.card.deceptionSeconds = 6; value.life.basil.location = "CABINET";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭欺瞒导师页面"));
    expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("folds optional conflict and shows independent Gideon resources, real source and non-damaging deceit", async () => {
    const command: DeceitMentorCommand = { type: "ENCOUNTER_TALK" };
    const value = projection({ promoted: true, actions: [action(command, "与吉迪恩实际交谈", "1行动")] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(false); await open("新原人的可选冲突");
    const facts = screen.getByRole("region", { name: "欺瞒导师原人遭遇" });
    for (const text of ["吉迪恩·哈特", "47岁", "DM3-GIDEON", "健康 80", "独立灵性 103 / 120", "DM3-GIDEON-ROD", "仍在原人手中", "旧拉尔夫", "无追逐"]) expect(facts.textContent).toContain(text);
    await open("本场范围与战斗代价");
    for (const text of ["吉迪恩本场有限能力", "灵性冲击5灵性", "屏护4灵性", "辨伪4灵性", "每轮实际60秒", "对方优势−36、−30", "只有普通STRIKE", "被抵仍实付成本", "缺资源仅普通回退"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button("与吉迪恩实际交谈")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps peaceful exit available as a real intent without resetting original enemy resources", () => {
    const command: DeceitMentorCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action({ type: "ENCOUNTER_FIGHT" }, "明确选择交战", "1行动"), action(command, "沿普通出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.scene!.clearanceConfirmed = true;
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button("沿普通出口和平离开"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before); expect(value.encounter.enemy!.spirituality).toBe(103);
  });

  it("shows a dead player's original final position as read-only with no free effects or resurrection", () => {
    const value = projection({ promoted: true, actions: [] }); value.resources!.health = 0; value.encounter.status = "LOST";
    value.encounter.enemy!.spirituality = 41; value.encounter.enemy!.weaponLocation = "COURT";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain("本周目已经死亡");
    expect(screen.getByRole("region", { name: "欺瞒导师当前行动" }).textContent).toContain("当前没有可提交的公开行动");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});


describe("DeceitMentorPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [] }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["吉迪恩本场能力来源为ORIGINAL_LIMITED_G：灵性冲击5灵性、屏护4灵性、辨伪4灵性。辨伪只抵本轮下一次成功欺瞒；被抵仍实付成本。缺资源仅普通回退，每轮实际60秒，共同伤势与死亡没有豁免。", "吉迪恩本场有限能力：灵性冲击5灵性、屏护4灵性、辨伪4灵性。辨伪只抵本轮下一次成功欺瞒；被抵仍实付成本。缺资源仅普通回退，每轮实际60秒，共同伤势与死亡没有豁免。"],
      ["序列3欺瞒导师及欺诈自然规律的方向已核；本场规则、秒数与资源均为原创G。序列2命运木马及以上尚未开放。", "序列3欺瞒导师可尝试有限欺瞒自然规律；本场规则、秒数与资源以当前说明为准。序列2命运木马及以上的能力不随本阶晋升直接获得。"],
      ["阿蒙无燃料亮灯一周的原文事例不能当作初晋普遍时长。当前续光16秒、迟落8秒、朝向误判最多6秒均为本作G；不下放换命、主辅颠倒、源堡复活骗局或天使分身。", "当前续光16秒、迟落8秒、朝向误判最多6秒；不能把他人的一周续光表现当作初晋普遍时长。不下放换命、主辅颠倒、源堡复活骗局或天使分身。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value.encounter.enemy?.source).toBe("ORIGINAL_LIMITED_G");
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
