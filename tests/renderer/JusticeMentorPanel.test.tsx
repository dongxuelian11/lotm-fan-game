/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JusticeMentorPanel, type JusticeMentorPanelProps } from "../../src/renderer/JusticeMentorPanel";
import type { JusticeMentorAction, JusticeMentorCommand, JusticeMentorProjection } from "../../src/domain/justice-mentor/types";
import { JUSTICE_MENTOR_CONSUMPTION_RISK } from "../../src/domain/justice-mentor/content";
import { createJusticeMentorLifeState } from "../../src/domain/justice-mentor/life";

type Attempt = NonNullable<JusticeMentorProjection["life"]["currentAttempt"]>;
type CaseId = JusticeMentorProjection["life"]["cases"][number]["id"];
function action(command: JusticeMentorCommand, label: string, cost = "0行动", extra: Partial<JusticeMentorAction> = {}): JusticeMentorAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取正义导师专业指导", "1行动 · 500便士");
const consume = (id = "justice-mentor-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
// Public renderer fixtures only; these are not domain eligibility tests or natural replays.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 117, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, abilityTier: null,
    ownerConsent: "UNASKED", ownerConsentWeek: null, ayaConsent: "UNASKED", nivenConsent: "UNASKED", spiritConsent: "UNASKED", ayaConsentWeek: null, nivenConsentWeek: null, spiritConsentWeek: null,
    siteVisited: false, stopped: false, refused: false, inspected: false, itemsReturned: false, playerReturned: false,
    routeChecked: false, carried: false, carryBenefit: false, chestReceived: false, helpersReturned: false, ayaEnergySpent: 0, nivenEnergySpent: 0, helperTravelMetres: 0, chestTravelMetres: 0,
    glyphs: [], lampRead: false, lampOilSpent: 0, hypothesis: null, hypothesisHistory: [], selbyAsked: false, nivenAsked: false, registerRead: false, verified: false,
    screenChecked: false, spiritSteppedOut: false, spiritDisposition: null, spiritTravelMetres: 0, lightActive: false, lightStopped: false, sampleSealed: false, sealSpent: 0, ...extra };
}
function life(): JusticeMentorProjection["life"] {
  const original = createJusticeMentorLifeState();
  return { ...original, tag: { id: original.tag.id, owner: original.tag.owner, location: original.tag.location },
    title: "正义导师有限合作与核实G", story: "三项原创G实践", environment: "原工作院与真实普通出口。",
    activeCase: null, inside: false, insideCase: false, reflected: false, currentAttempt: null, actions: [],
    cases: ([
      { id: "paired-lift", title: "同一原箱与两位助手", story: "两位当前自愿的原助手沿8米干燥平路合作，将同一原箱交给原主人。" },
      { id: "faded-label", title: "原淡标记与原交接册", story: "借原灯与放大镜核读原有字形，写假说后再问原人与读原记录。" },
      { id: "shielded-sample", title: "原友善灵与有限污秽残留", story: "原灵实际走出太阳作用范围，再处理低强度超自然残留与普通封存。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): JusticeMentorProjection["encounter"] {
  return { title: "原干燥院场与独立的科温", story: "2米净空原干燥院场，普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    scene: { courtId: "JM3-COURT", ground: "DRY", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: false },
    enemy: { id: "JM3-CORWIN", name: "科温", age: 49, source: "ORIGINAL_CLEARED_COURT_ADULT_G", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "JM3-CORWIN-CLUB", weaponLocation: "HAND", powerUses: { LIGHT_STRIKE: 1, LIGHT_WARD: 2, FOCUS: 1 } },
    actions: [], facts: ["实际普通出口开放，无追逐。", "本轮定神只抵下一次成功清晰标记或领域牵制，不抵普通太阳攻击。"] };
}
function projection(extra: Partial<JusticeMentorProjection> = {}): JusticeMentorProjection {
  return { title: "正义导师·太阳序列3（合作与核实G）", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "正义导师序列3名称已核实，两项新技巧、有限场景与定量均为G。", supplies: "三瓶独立成品各6200便士，或各五次劳务后800便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `justice-mentor-potion-${n}`, title: `正义导师第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签JM3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `justice-mentor-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_TERMS", title: "自愿条款与渠道核对", completedWeek: 112 },
      { taskId: "REVIEW_BOUNDARIES", title: "太阳作用与证据边界", completedWeek: 113 }, { taskId: "PLAN_RETURN", title: "普通返程核对", completedWeek: 113 }],
    preparedWeek: 116, abilities: [{ id: "sun.s3.shared-radiance", label: "共享光辉（本作G）", mastery: 0, description: "仅鼓舞已自愿且有实际精力的两位助手。" },
      { id: "sun.s3.clarity-mark", label: "清晰标记（本作G）", mastery: 0, description: "仅显现实际原物上原有字形，不能代替原证词与记录。" },
      { id: "sun.s4.purification", label: "继承净化", mastery: 24, description: "旧净化仍会伤及友善灵，须实际退出范围。" }],
    acting: 0, digestion: "原无暗者消化100，从第104周晋升已过12整周。", pollution: 3, risk: JUSTICE_MENTOR_CONSUMPTION_RISK,
    resources: { health: 70, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧埃德蒙UD4-EDMUND，健康60，SURRENDERED，原棍COURTYARD。", "原奥尔登LOW，3次出入；原特性污染0，原盒BENCH。",
      "原石板1处焦痕，60秒冷却已真实完成。", "原情感RETURNED，本人OUTSIDE；六种原材料去向保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原工作院、真实位置和普通出口。", ...extra };
}
function activate(value: JusticeMentorProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<JusticeMentorPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<JusticeMentorPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("JusticeMentorPanel verified S3, original G cooperation and original-object continuity", () => {
  it("leads with real readiness and resources, folding detailed rules and hiding unknown recipe materials", () => {
    const reason = "从原无暗者晋升起仅11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应出现的假材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain(reason);
    expect(button("听取正义导师专业指导").disabled).toBe(true);
    expect(button("听取正义导师专业指导").getAttribute("aria-describedby")).toContain("justice-mentor-reason-");
    const resources = screen.getByRole("region", { name: "正义导师当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["70 / 100", "85 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不应出现的假材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "技巧与使用范围", "原身体、旧埃德蒙与原物", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取正义导师专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps independent medicine, separate Lightseeker promotion and read-only S4 history", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("序列3正义导师");
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("下一序列2逐光者（古称逐日者）");
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("仍须另行晋升，本页不直接授予其能力");
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "正义导师成品与配方边界" });
    for (const text of ["完整配方", "6200", "800", "500便士", "120便士", "12整周", "第112周", "原消化100", "三项不同准备各1行动", "0行动独立确认服用所选原瓶", "普通死亡", "旧序列4的情感剥离与回输仪式不会作为本阶任务重做"]) expect(boundary.textContent).toContain(text);
    await open("原身体、旧埃德蒙与原物");
    const history = screen.getByRole("region", { name: "正义导师继承记录" });
    for (const text of ["女性", "UD4-EDMUND", "健康60", "SURRENDERED", "原棍COURTYARD", "原奥尔登LOW", "3次出入", "原特性污染0", "原盒BENCH", "1处焦痕", "60秒冷却", "RETURNED", "原材料"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and emits its exact original labour intent without mutating it", async () => {
    const commands: JusticeMentorCommand[] = [{ type: "POTION_WORK", bottleId: "justice-mentor-potion-1" }, { type: "POTION_WORK", bottleId: "justice-mentor-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立正义导师原瓶" }), "justice-mentor-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews only one original bottle, risk and actual resources, then cancels with Escape and restores focus", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "正义导师原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "正义导师第1独立原瓶" }));
    for (const text of ["justice-mentor-potion-1", "JM3-SEAL-1", "71%", "第116周", "成功或失败", "性别不改变", "当前灵性不补满", "普通死亡", "0行动", "意志难度30", "大成功", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("JM3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "正义导师原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits one confirmed intent and keeps it locked through failed save until a changed committed projection arrives", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<JusticeMentorPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "正义导师原瓶服用确认" })).toBeTruthy();
    rerender(<JusticeMentorPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = [];
    saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "正义导师原瓶服用确认" })).toBeNull();
    expect(button("关闭正义导师页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });


  it("keeps a failed original bottle spent and resumes real labour on another bottle without changing current resources", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, defaults, rerender } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    const saved = structuredClone(value); saved.preparedWeek = null;
    saved.bottles[0]!.status = "原瓶已耗尽 · 晋升失败";
    saved.bottles[1]!.status = "仍在原供应人处 · 劳务0/5";
    saved.resources = { ...saved.resources!, health: 55, mind: 60 };
    const work: JusticeMentorCommand = { type: "POTION_WORK", bottleId: "justice-mentor-potion-2" };
    saved.actions = [action(work, "为第二独立原瓶实际劳务", "1行动")];
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "正义导师原瓶服用确认" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择独立正义导师原瓶" }) as HTMLSelectElement).value).toBe("justice-mentor-potion-2");
    expect(screen.getByRole("region", { name: "正义导师当前资源" }).textContent).toContain("55 / 100");
    await open("独立成品与晋升准备");
    expect(screen.getByRole("region", { name: "正义导师成品与配方边界" }).textContent).toContain("原瓶已耗尽 · 晋升失败");
    const before = structuredClone(saved); fireEvent.click(button("为第二独立原瓶实际劳务"));
    expect(onCommand).toHaveBeenLastCalledWith(work); expect(onCommand).toHaveBeenCalledTimes(2); expect(saved).toEqual(before);
  });

  it("invalidates an unsubmitted review when the original cost or resource facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    for (const changed of [{ ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, resources: { ...value.resources!, spirituality: 41 } }]) {
      rerender(<JusticeMentorPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<JusticeMentorPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "正义导师原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative blocker", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<JusticeMentorPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原现场尚未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true);
    expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("justice-mentor-confirm-reason");
    expect(screen.getByRole("region", { name: "正义导师原瓶服用确认" }).textContent).toContain("原现场尚未收束");
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("locks commands, selectors and dismissal during pending recovery: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("听取正义导师专业指导").disabled).toBe(true); expect(button("关闭正义导师页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立正义导师原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("听取正义导师专业指导")); fireEvent.click(button("关闭正义导师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });


  it.each([
    [{ type: "PREPARE_TASK", taskId: "CHECK_TERMS" }, "亲自核对自愿条款", "1行动"],
    [{ type: "PREPARE_PROMOTION" }, "检查本周服药场地", "1行动 · 120便士"],
    [{ type: "REQUEST_SUPPLY" }, "向原渠道申请补货", "1行动 · 须跨真实周"],
    [{ type: "RECEIVE_SUPPLY" }, "接收同渠道新原瓶", "0行动 · 原封签独立保存"],
  ] as const)("forwards acquisition costs and supply intent unchanged: %j", (command, label, cost) => {
    const value = projection({ actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("shows current selected-case stages and leaves a new case unstarted until its typed intent is submitted", async () => {
    const commands: JusticeMentorCommand[] = [{ type: "OBSERVE", caseId: "paired-lift" }, { type: "OBSERVE", caseId: "faded-label" }];
    const value = projection({ promoted: true, actions: commands.map((command, i) => action(command, i ? "观察原淡标记" : "观察原箱与两位助手", "1行动")) });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择正义导师生活情境" }), "faded-label");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察原箱与两位助手/ })).toBeNull();
    const scene = screen.getByRole("region", { name: "当前正义导师生活情境" });
    expect(scene.textContent).toContain("观察、准备、实施与报告各1行动"); expect(scene.textContent).toContain("现场子步0行动");
    fireEvent.click(button("观察原淡标记")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it.each(["原周目已经结束，仅可查看。", "角色已经死亡，原记录只读保留。"])("honours the authoritative ended/dead blocker: %s", reason => {
    const command: JusticeMentorCommand = { type: "OBSERVE", caseId: "paired-lift" };
    const value = projection({ promoted: true, actions: [action(command, "观察原箱与两位助手", "1行动", { enabled: false, reason })] });
    const { onCommand } = panel(value);
    expect(button("观察原箱与两位助手").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain(reason);
    fireEvent.click(button("观察原箱与两位助手")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: "PREPARE", caseId: "paired-lift", method: "ABILITY" }, "本次准备有限鼓舞", "1行动 · 须留足2行动"],
    [{ type: "PERFORM", caseId: "paired-lift" }, "进入真实原箱现场", "1行动"],
    [{ type: "REPORT", caseId: "paired-lift" }, "报告本次原箱实际结果", "1行动"],
  ] as const)("keeps the outer stage action distinct from zero-action substeps: %j", (command, label, cost) => {
    const value = projection({ promoted: true, actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });


  it("shows independent Corwin, actual clearance and his original weapon with an ordinary exit", async () => {
    const command: JusticeMentorCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(command, "沿原干燥出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.scene!.clearanceConfirmed = true;
    const before = structuredClone(value), { onCommand } = panel(value);
    const original = screen.getByRole("region", { name: "正义导师原人遭遇" });
    for (const text of ["科温", "49岁", "JM3-CORWIN", "健康 90", "精神 100", "独立灵性 103 / 120", "JM3-CORWIN-CLUB", "仍在原人手中", "旧埃德蒙分别保存", "JM3-COURT", "第三人 0 人", "已实际确认", "原普通出口开放"])
      expect(original.textContent).toContain(text);
    expect(fold("本场范围与战斗代价").open).toBe(false); await open("本场范围与战斗代价");
    for (const text of ["共享光辉6灵性", "清晰标记6灵性", "无暗领域5灵性", "净化光6灵性", "共同轮盘", "不授予自动友军免疫"])
      expect(original.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前正义导师生活情境" })).toBeNull();
    fireEvent.click(button("沿原干燥出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("does not present a planned combat clearance as an actual check", async () => {
    panel(projection({ promoted: true, actions: [] }));
    await open("新原人的可选冲突");
    const original = screen.getByRole("region", { name: "正义导师原人遭遇" });
    expect(original.textContent).toContain("尚未实际确认净空"); expect(original.textContent).not.toContain("已实际确认他人均在作用范围外");
  });

  it("folds optional combat away from the current objective and opens it without starting a fight", async () => {
    const command: JusticeMentorCommand = { type: "ENCOUNTER_TALK" };
    const value = projection({ promoted: true, actions: [action(command, "前往原科温处交谈", "1行动 · 另留开战1行动"),
      action({ type: "OBSERVE", caseId: "paired-lift" }, "观察原箱与两位助手", "1行动")] }), before = structuredClone(value), { onCommand } = panel(value);
    const optionalFold = fold("新原人的可选冲突"), talk = button("前往原科温处交谈");
    // JSDOM does not simulate native details visibility; assert the native open state and structure.
    expect(optionalFold.open).toBe(false); expect(talk.closest("details")).toBe(optionalFold);
    expect(screen.getByRole("region", { name: "正义导师当前行动" }).contains(talk)).toBe(false);
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("下一步：观察原箱与两位助手");
    await open("新原人的可选冲突"); expect(optionalFold.open).toBe(true); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(talk); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("renders the supplied technique masteries and preserves real ability limits", async () => {
    const value = projection({ promoted: true }), before = structuredClone(value); panel(value); await open("技巧与使用范围");
    const abilities = screen.getByRole("region", { name: "正义导师能力与使用范围" });
    // Isolated input labels are rendered verbatim; this is not a public-projector assertion.
    for (const ability of value.abilities) expect(abilities.textContent).toContain(`${ability.label} · 掌握 ${ability.mastery}`);
    for (const text of ["每次尝试6灵性", "意志18", "知识18", "只增加旧净化掌握8", "不增加两项", "签名仍须本人认可", "善恶雷达", "法律身份", "古称逐日者", "不自动免疫或召回"])
      expect(abilities.textContent).toContain(text);
    expect(value.abilities.map(ability => ability.mastery)).toEqual([0, 0, 24]); expect(value).toEqual(before);
  });

  it.each([
    [{ type: "ENCOURAGE", caseId: "paired-lift" }, "有限鼓舞两位自愿助手", "0行动 · 6灵性 · 意志18"],
    [{ type: "REVEAL_GLYPHS", caseId: "faded-label" }, "显现同一原牌的已有字形", "0行动 · 6灵性 · 知识18"],
    [{ type: "PURIFY", caseId: "shielded-sample" }, "施放继承的有限净化", "0行动 · 6灵性 · 意志18"],
  ] as const)("shows the real spiritual cost of each zero-AP ability and preserves the original intent: %j", (command, label, cost) => {
    const value = activate(projection({ promoted: true, actions: [action(command, label, cost)] }), command.caseId);
    value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); expect(button(label).disabled).toBe(false);
    fireEvent.click(button(label)); fireEvent.click(button(label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("folds unavailable inner steps while keeping current permission and cost in front", async () => {
    const command: JusticeMentorCommand = { type: "CONSENT_OWNER", caseId: "paired-lift" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面取得本次物主许可", "0行动 · 2秒"),
      action({ type: "CARRY_CHEST", caseId: "paired-lift" }, "两位原助手沿8米普通路运箱", "0行动 · 8秒 · 两人各6精力", { enabled: false, reason: "先取得两位当前自愿许可并检查普通路线。" })] }), "paired-lift");
    const { onCommand } = panel(value), later = button("两位原助手沿8米普通路运箱"), unavailable = fold("其它步骤与未满足条件");
    expect(unavailable.open).toBe(false); expect(later.closest("details")).toBe(unavailable); expect(later.disabled).toBe(true);
    expect(button("当面取得本次物主许可").closest("details")).toBeNull();
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("下一步：当面取得本次物主许可");
    await open("其它步骤与未满足条件"); expect(unavailable.open).toBe(true); expect(unavailable.textContent).toContain("各6精力");
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("当面取得本次物主许可")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
  });

  it("exposes no scene originals, earned glyphs or resolution before observing the label case", () => {
    const value = projection({ promoted: true, actions: [action({ type: "OBSERVE", caseId: "faded-label" }, "观察原牌与交接册", "1行动")] });
    const { container, onCommand } = panel(value);
    fireEvent.change(screen.getByRole("combobox", { name: "选择正义导师生活情境" }), { target: { value: "faded-label" } });
    expect(screen.queryByRole("region", { name: "正义导师原人原物与普通退路" })).toBeNull();
    for (const text of ["OLD_BAY", "SECOND_SHIFT", "JM3-REGISTER", "旧牌调到备用箱", "尼文将旧库位牌"])
      expect(container.textContent).not.toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("respects a helper's current refusal and offers the actual ordinary exit without moving a box", () => {
    const command: JusticeMentorCommand = { type: "RETURN_PLAYER", caseId: "paired-lift" };
    const value = activate(projection({ promoted: true, actions: [action(command, "尊重拒绝并沿普通路退出", "0行动 · 0灵性"),
      action({ type: "CARRY_CHEST", caseId: "paired-lift" }, "两位助手开始搬原箱", "0行动 · 两人各6精力", { enabled: false, reason: "阿娅已拒绝本次用途。" })] }), "paired-lift", attempt({ ayaConsent: "DECLINED", nivenConsent: "GRANTED", refused: true }));
    value.life.playerLocation = "START"; value.life.aya.willing = false; value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一原箱与两位实际助手" });
    for (const text of ["阿娅", "37岁", "JM3-AYA", "尼文", "44岁", "JM3-NIVEN", "阿娅当前已拒绝继续", "JM3-CHEST", "在原箱起点", "剩余精力 100", "本次尚未实际搬运"])
      expect(originals.textContent).toContain(text);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(button("两位助手开始搬原箱").disabled).toBe(true);
    expect(button("尊重拒绝并沿普通路退出").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "正义导师停止与普通收束" }).contains(button("尊重拒绝并沿普通路退出"))).toBe(true);
    fireEvent.click(button("尊重拒绝并沿普通路退出")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("does not treat successful encouragement as movement or free energy", () => {
    const command: JusticeMentorCommand = { type: "CARRY_CHEST", caseId: "paired-lift" };
    const value = activate(projection({ promoted: true, actions: [action(command, "沿原8米共同搬同一箱", "0行动 · 8秒 · 两人各3精力")] }), "paired-lift",
      attempt({ ownerConsent: "GRANTED", ayaConsent: "GRANTED", nivenConsent: "GRANTED", routeChecked: true, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.playerLocation = "START";
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一原箱与两位实际助手" });
    for (const text of ["剩余精力 100", "累计实际行程 0 米", "在原箱起点", "鼓舞成功也不等于已搬箱", "出发前至少8精力", "回程另各耗2"])
      expect(originals.textContent).toContain(text);
    expect(button("沿原8米共同搬同一箱").textContent).toContain("两人各3精力");
    fireEvent.click(button("沿原8米共同搬同一箱")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps a failed six-spirit attempt and ordinary carry costs while custody awaits the actual owner", () => {
    const command: JusticeMentorCommand = { type: "RECEIVE_CHEST", caseId: "paired-lift" };
    const value = activate(projection({ promoted: true, actions: [action(command, "由原主当面接收同一箱", "0行动 · 1秒")] }), "paired-lift",
      attempt({ abilityTier: "FAILURE", spiritualitySpent: 6, carried: true, ayaEnergySpent: 6, nivenEnergySpent: 6, helperTravelMetres: 8, chestTravelMetres: 8 }));
    value.life.playerLocation = "BENCH"; value.life.chest.location = "BENCH"; value.life.chest.custody = "HELPERS"; value.life.chest.travelMetres = 8;
    for (const helper of [value.life.aya, value.life.niven]) { helper.location = "BENCH"; helper.energy = 94; helper.travelMetres = 8; }
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一原箱与两位实际助手" });
    for (const text of ["剩余精力 94", "累计实际行程 8 米", "仍由两位原助手保管，尚未交接", "须原主当面接收同一箱", "尚无本次两位助手回程完成记录"])
      expect(originals.textContent).toContain(text);
    const costs = screen.getByRole("region", { name: "正义导师本次尝试与代价" });
    for (const text of ["本案唯一能力判定：失败", "不能重骰", "已付灵性 6", "阿娅实付精力 6", "尼文实付精力 6", "原箱实际行程 8 米"])
      expect(costs.textContent).toContain(text);
    fireEvent.click(button("由原主当面接收同一箱")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("preserves the original box at its owner while both original helpers pay for an ordinary return", () => {
    const command: JusticeMentorCommand = { type: "RETURN_HELPERS", caseId: "paired-lift" };
    const value = activate(projection({ promoted: true, actions: [action(command, "两位原助手沿8米空手返回", "0行动 · 8秒 · 两人各2精力")] }), "paired-lift",
      attempt({ carried: true, chestReceived: true, ayaEnergySpent: 6, nivenEnergySpent: 6, helperTravelMetres: 8, chestTravelMetres: 8 }));
    value.life.playerLocation = "BENCH"; value.life.chest.location = "BENCH"; value.life.chest.custody = "OWNER";
    for (const helper of [value.life.aya, value.life.niven]) { helper.location = "BENCH"; helper.energy = 94; helper.travelMetres = 8; }
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0; value.resources!.mind = 0;
    const { defaults, rerender, onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭正义导师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("两位原助手沿8米空手返回")); fireEvent.click(button("两位原助手沿8米空手返回"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    rerender(<JusticeMentorPanel {...defaults} error={{ message: "原助手回程保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(button("关闭正义导师页面").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "同一原箱与两位实际助手" }).textContent).toContain("剩余精力 94");
    rerender(<JusticeMentorPanel {...defaults} value={structuredClone(value)} />); expect(button("两位原助手沿8米空手返回").disabled).toBe(true);
    const saved = structuredClone(value); saved.life.currentAttempt!.helpersReturned = true;
    for (const helper of [saved.life.aya, saved.life.niven]) { helper.location = "START"; helper.energy = 92; helper.travelMetres = 16; }
    saved.actions = [action({ type: "RETURN_PLAYER", caseId: "paired-lift" }, "本人另走8米回出口", "0行动 · 8米/8秒")];
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    const originals = screen.getByRole("region", { name: "同一原箱与两位实际助手" });
    for (const text of ["剩余精力 92", "累计实际行程 16 米", "已实际空手返回", "JM3-CHEST · 在原主人接收台", "由原主人保管"])
      expect(originals.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "正义导师原人原物与普通退路" }).textContent).toContain("本人在原主人接收台");
    expect(button("本人另走8米回出口").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("shows no earned glyph or answer after failed magic and keeps the real lamp alternative cost", () => {
    const command: JusticeMentorCommand = { type: "READ_LAMP", caseId: "faded-label" };
    const value = activate(projection({ promoted: true, actions: [action(command, "用原灯和放大镜普通核读", "0行动 · 4秒 · 原灯油−1"),
      action({ type: "REVEAL_GLYPHS", caseId: "faded-label" }, "再次尝试能力", "0行动 · 6灵性", { enabled: false, reason: "每案仅一次实际检验，失败不重骰。" })] }), "faded-label",
      attempt({ abilityTier: "GREAT_FAILURE", spiritualitySpent: 6, ownerConsent: "GRANTED" }));
    value.life.playerLocation = "TABLE";
    for (const item of [value.life.tag, value.life.register, value.life.magnifier, value.life.lamp]) item.location = "PLAYER";
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand, container } = panel(value), evidence = screen.getByRole("region", { name: "原有字形与实际证据" });
    for (const text of ["尚无已读出的字形", "JM3-TAG", "JM3-REGISTER", "JM3-MAGNIFIER", "耐久 100", "JM3-LAMP", "剩余灯油 2 单位", "当前假说：尚未提出", "塞尔比未问、尼文未问", "尚未亲自读取", "另耗4秒、原灯油1单位"])
      expect(evidence.textContent).toContain(text);
    for (const text of ["OLD_BAY", "SECOND_SHIFT", "旧牌调到备用箱", "尼文将旧库位牌"])
      expect(container.textContent).not.toContain(text);
    expect(button("再次尝试能力").disabled).toBe(true); expect(button("用原灯和放大镜普通核读").disabled).toBe(false);
    expect(button("用原灯和放大镜普通核读").textContent).toContain("原灯油−1");
    fireEvent.click(button("用原灯和放大镜普通核读")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it.each([true, false])("shows actually earned glyphs without treating them as witness evidence (ordinary lamp: %s)", ordinary => {
    const command: JusticeMentorCommand = { type: "HYPOTHESIZE", caseId: "faded-label", hypothesis: "MISSING_ITEM" };
    const value = activate(projection({ promoted: true, actions: [action(command, "先记录待证假说", "0行动 · 1秒")] }), "faded-label",
      attempt({ glyphs: ["OLD_BAY", "SECOND_SHIFT"], abilityTier: ordinary ? "FAILURE" : "SUCCESS", spiritualitySpent: 6,
        lampRead: ordinary, lampOilSpent: ordinary ? 1 : 0 }));
    value.life.playerLocation = "TABLE"; value.life.lamp.oil = ordinary ? 1 : 2;
    const before = structuredClone(value), { onCommand, container } = panel(value), evidence = screen.getByRole("region", { name: "原有字形与实际证据" });
    for (const text of ["OLD_BAY（旧库位）", "SECOND_SHIFT（第二班）", "原有字形不自动给出失主、用途或罪责", "当前假说：尚未提出", "塞尔比未问、尼文未问", "假说不是事实"])
      expect(evidence.textContent).toContain(text);
    expect(evidence.textContent).toContain(`剩余灯油 ${ordinary ? 1 : 2} 单位`);
    expect(container.textContent).not.toContain("旧牌调到备用箱"); expect(container.textContent).not.toContain("尼文将旧库位牌");
    fireEvent.click(button("先记录待证假说")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps the wrong original hypothesis until actual testimony and the original register support correction", () => {
    const command: JusticeMentorCommand = { type: "READ_REGISTER", caseId: "faded-label" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲读同一原交接签注", "0行动 · 3秒"),
      action({ type: "VERIFY", caseId: "faded-label" }, "核实本次假说", "0行动 · 2秒", { enabled: false, reason: "须先亲读原签注，按实际证据核实。" })] }), "faded-label",
      attempt({ glyphs: ["OLD_BAY", "SECOND_SHIFT"], hypothesis: "MISSING_ITEM", hypothesisHistory: ["MISSING_ITEM"], selbyAsked: true, nivenAsked: true }));
    value.life.playerLocation = "TABLE"; value.life.register.location = "PLAYER";
    const { defaults, rerender, onCommand } = panel(value);
    let evidence = screen.getByRole("region", { name: "原有字形与实际证据" });
    for (const text of ["当前假说：可能涉及遗失物", "塞尔比已问、尼文已问", "尚未亲自读取"])
      expect(evidence.textContent).toContain(text);
    expect(button("核实本次假说").disabled).toBe(true);
    fireEvent.click(button("亲读同一原交接签注")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const saved = structuredClone(value), correction: JusticeMentorCommand = { type: "HYPOTHESIZE", caseId: "faded-label", hypothesis: "REASSIGNED" };
    saved.life.currentAttempt!.registerRead = true;
    saved.life.cases[1]!.observations = ["同一原签注记：第二班，尼文将旧库位牌转作备用箱保管牌。"];
    saved.actions = [action(correction, "根据原签注修正原假说", "0行动 · 1秒 · 原假说保留")];
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    evidence = screen.getByRole("region", { name: "原有字形与实际证据" });
    expect(evidence.textContent).toContain("当前假说：可能涉及遗失物"); expect(evidence.textContent).toContain("已亲自读取");
    expect(screen.getByRole("region", { name: "本案已取得的原观察" }).textContent).toContain("尼文将旧库位牌转作备用箱保管牌");
    fireEvent.click(button("根据原签注修正原假说")); expect(onCommand).toHaveBeenLastCalledWith(correction); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("keeps corrected history, the original box position and spent lamp oil during real custody return", () => {
    const command: JusticeMentorCommand = { type: "RETURN_ITEMS", caseId: "faded-label" };
    const value = activate(projection({ promoted: true, actions: [action(command, "携原牌原册原工具当面交还", "0行动 · 5米/6秒")] }), "faded-label",
      attempt({ glyphs: ["OLD_BAY", "SECOND_SHIFT"], hypothesis: "REASSIGNED", hypothesisHistory: ["MISSING_ITEM", "REASSIGNED"], selbyAsked: true, nivenAsked: true,
        registerRead: true, verified: true, lampRead: true, lampOilSpent: 1, abilityTier: "FAILURE", spiritualitySpent: 6 }));
    value.life.playerLocation = "TABLE"; value.life.chest.location = "BENCH"; value.life.chest.travelMetres = 8; value.life.lamp.oil = 1;
    for (const item of [value.life.tag, value.life.register, value.life.magnifier, value.life.lamp]) item.location = "PLAYER";
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const { defaults, rerender, onCommand } = panel(value), evidence = screen.getByRole("region", { name: "原有字形与实际证据" });
    for (const text of ["可能涉及遗失物 → 旧牌调到备用箱", "原错误假说仍保留", "本人仍保管原借物", "JM3-CHEST 当前仍在原主人接收台", "查阅记录不会搬动原箱", "剩余灯油 1 单位"])
      expect(evidence.textContent).toContain(text);
    fireEvent.click(button("携原牌原册原工具当面交还")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const saved = structuredClone(value); saved.life.currentAttempt!.itemsReturned = true; saved.life.playerLocation = "BENCH";
    for (const item of [saved.life.tag, saved.life.register, saved.life.magnifier, saved.life.lamp]) item.location = "OWNER";
    saved.actions = [action({ type: "RETURN_PLAYER", caseId: "faded-label" }, "本人沿8米普通路回出口", "0行动 · 8米/8秒")];
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    const returned = screen.getByRole("region", { name: "原有字形与实际证据" });
    for (const text of ["已亲手归还", "JM3-TAG 在原主人处", "JM3-REGISTER 在原主人处", "剩余灯油 1 单位"])
      expect(returned.textContent).toContain(text);
    expect(button("本人沿8米普通路回出口").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("keeps a friendly spirit's consent separate from its actual exit before purification", () => {
    const command: JusticeMentorCommand = { type: "MOVE_SPIRIT", caseId: "shielded-sample" };
    const value = activate(projection({ promoted: true, actions: [action(command, "原榆音沿4米普通廊道退开", "0行动 · 4米/4秒"),
      action({ type: "PURIFY", caseId: "shielded-sample" }, "施放继承净化", "0行动 · 6灵性", { enabled: false, reason: "原灵仍在TABLE，同意不等于实际退到SIDE。" })] }), "shielded-sample",
      attempt({ ownerConsent: "GRANTED", screenChecked: true, spiritConsent: "GRANTED" }));
    value.life.playerLocation = "TABLE"; value.life.screen.placed = true;
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一友善灵与原样本封存" });
    for (const text of ["既存原友善灵 榆音", "JM3-ELM", "当前在原核读与试验台", "累计实际行程 0 米", "已当面同意", "同意不等于已经移动", "JM3-SCREEN", "已实际摆好", "耐久 100", "不授予太阳免疫"])
      expect(originals.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "正义导师原人原物与普通退路" }).textContent).toContain("JM3-DOOR · 实际开放");
    expect(button("施放继承净化").disabled).toBe(true);
    fireEvent.click(button("原榆音沿4米普通廊道退开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("accepts the original spirit's refusal and allows ordinary sealing without a spell or phantom exit", () => {
    const command: JusticeMentorCommand = { type: "SEAL_SAMPLE", caseId: "shielded-sample" };
    const value = activate(projection({ promoted: true, actions: [action(command, "尊重原灵拒绝并普通封存原样本", "0行动 · 2秒 · 原封条1→0"),
      action({ type: "PURIFY", caseId: "shielded-sample" }, "对原样本施放净化", "0行动 · 6灵性", { enabled: false, reason: "友善原灵拒绝离开，仍在原台旁。" })] }), "shielded-sample",
      attempt({ siteVisited: true, screenChecked: true, spiritConsent: "DECLINED", refused: true }));
    value.life.playerLocation = "TABLE"; value.life.elm.willing = false; value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一友善灵与原样本封存" });
    for (const text of ["已拒绝本次用途", "榆音当前不愿继续", "当前在原核读与试验台", "本次太阳作用：尚未施放", "实际残留强度 2", "尚未封存", "剩余 1"])
      expect(originals.textContent).toContain(text);
    expect(button("对原样本施放净化").disabled).toBe(true); expect(button("尊重原灵拒绝并普通封存原样本").disabled).toBe(false);
    fireEvent.click(button("尊重原灵拒绝并普通封存原样本")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows a failed purification's still-active light and original intensity until a real zero-AP stop", () => {
    const command: JusticeMentorCommand = { type: "STOP_EFFECT", caseId: "shielded-sample" };
    const value = activate(projection({ promoted: true, actions: [action(command, "实际停止本次太阳作用", "0行动 · 1秒")] }), "shielded-sample",
      attempt({ siteVisited: true, screenChecked: true, spiritConsent: "GRANTED", spiritSteppedOut: true, spiritTravelMetres: 4,
        abilityTier: "FAILURE", spiritualitySpent: 6, lightActive: true }));
    value.life.playerLocation = "TABLE"; value.life.screen.placed = true; value.life.elm.location = "SIDE"; value.life.elm.travelMetres = 4;
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand, container } = panel(value), originals = screen.getByRole("region", { name: "同一友善灵与原样本封存" });
    for (const text of ["当前在四米普通廊道外侧", "累计实际行程 4 米", "已沿4米普通廊道实际退开", "本次太阳作用：仍在进行，须实际停止", "实际残留强度 2", "原残留仍为2，不能称作已净化", "数量 1", "尚未封存"])
      expect(originals.textContent).toContain(text);
    expect(container.textContent).not.toContain("窗口剩余"); expect(container.textContent).not.toContain("原残留已实际净化");
    const costs = screen.getByRole("region", { name: "正义导师本次尝试与代价" });
    expect(costs.textContent).toContain("已付灵性 6"); expect(costs.textContent).toContain("原榆音实际行程 4 米");
    expect(screen.getByRole("region", { name: "正义导师停止与普通收束" }).contains(button("实际停止本次太阳作用"))).toBe(true);
    fireEvent.click(button("实际停止本次太阳作用")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows actual seal consumption without laundering failed purification into a clean original sample", () => {
    const command: JusticeMentorCommand = { type: "SEAL_SAMPLE", caseId: "shielded-sample" };
    const value = activate(projection({ promoted: true, actions: [action(command, "把同一样本放回原盒并封存", "0行动 · 2秒 · 原封条1→0")] }), "shielded-sample",
      attempt({ siteVisited: true, abilityTier: "GREAT_FAILURE", spiritualitySpent: 6, lightStopped: true, spiritSteppedOut: true, spiritTravelMetres: 4 }));
    value.life.playerLocation = "TABLE"; value.life.elm.location = "SIDE"; value.life.elm.travelMetres = 4;
    const { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button("把同一样本放回原盒并封存")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const saved = structuredClone(value); saved.life.currentAttempt!.sampleSealed = true; saved.life.currentAttempt!.sealSpent = 1;
    saved.life.sample.sealed = true; saved.life.sample.location = "BOX"; saved.life.seal.remaining = 0;
    saved.actions = [action({ type: "INVITE_SPIRIT_RETURN", caseId: "shielded-sample" }, "停光后另行邀请原灵返回", "0行动 · 邀请2秒，返回另4米/4秒")];
    rerender(<JusticeMentorPanel {...defaults} value={saved} />);
    const originals = screen.getByRole("region", { name: "同一友善灵与原样本封存" });
    for (const text of ["本次太阳作用：已实际停止", "JM3-SAMPLE", "数量 1", "实际残留强度 2", "在同一原封存盒", "JM3-SAMPLE-BOX", "已真实封存", "JM3-SEAL · 剩余 0", "普通封存保留未净化事实", "当前在四米普通廊道外侧"])
      expect(originals.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "正义导师本次尝试与代价" }).textContent).toContain("原封条实耗 1");
    expect(button("停光后另行邀请原灵返回").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each(["RETURNED", "STAY_SIDE"] as const)("keeps the original spirit's actual post-light disposition and ordinary route: %s", disposition => {
    const command: JusticeMentorCommand = { type: "RETURN_PLAYER", caseId: "shielded-sample" };
    const value = activate(projection({ promoted: true, actions: [action(command, "本人沿4米普通路退出", "0行动 · 4米/4秒")] }), "shielded-sample",
      attempt({ siteVisited: true, abilityTier: "SUCCESS", spiritualitySpent: 6, lightStopped: true, sampleSealed: true, sealSpent: 1,
        spiritSteppedOut: true, spiritDisposition: disposition, spiritTravelMetres: disposition === "RETURNED" ? 8 : 4, refused: disposition === "STAY_SIDE" }));
    value.life.playerLocation = "TABLE"; value.life.sample.contamination = 0; value.life.sample.location = "BOX"; value.life.sample.sealed = true; value.life.seal.remaining = 0;
    value.life.elm.location = disposition === "RETURNED" ? "TABLE" : "SIDE"; value.life.elm.willing = disposition === "RETURNED"; value.life.elm.travelMetres = disposition === "RETURNED" ? 8 : 4;
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一友善灵与原样本封存" });
    expect(originals.textContent).toContain(disposition === "RETURNED" ? "同一原灵自愿沿原4米走回" : "原灵拒绝返回，实际留在SIDE");
    expect(originals.textContent).toContain(`累计实际行程 ${disposition === "RETURNED" ? 8 : 4} 米`);
    for (const text of ["实际残留强度 0", "原残留已实际净化", "已真实封存", "只加旧净化掌握8"])
      expect(originals.textContent).toContain(text);
    expect(button("本人沿4米普通路退出").disabled).toBe(false);
    fireEvent.click(button("本人沿4米普通路退出")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps returned originals, actual failed costs and the corrected hypothesis in closed case history", async () => {
    const value = projection({ promoted: true, actions: [] }), saved = attempt({ closed: true, result: "ORDINARY", ownerConsent: "CLOSED", itemsReturned: true, playerReturned: true, inspected: true,
      glyphs: ["OLD_BAY", "SECOND_SHIFT"], hypothesis: "REASSIGNED", hypothesisHistory: ["MISSING_ITEM", "REASSIGNED"], selbyAsked: true, nivenAsked: true,
      registerRead: true, verified: true, abilityTier: "FAILURE", spiritualitySpent: 6, lampRead: true, lampOilSpent: 1, elapsedSeconds: 44, playerTravelMetres: 32 });
    const entry = value.life.cases[1]!; entry.status = "RESOLVED"; entry.attempts = [saved]; entry.returned = true; entry.closes = 1; entry.result = "普通核实完成，原牌、原册、原灯与放大镜已归还。";
    value.life.lamp.oil = 1; for (const item of [value.life.tag, value.life.register, value.life.magnifier, value.life.lamp]) item.location = "OWNER";
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择正义导师生活情境" }), "faded-label");
    expect(screen.getByRole("region", { name: "原有字形与实际证据" }).textContent).toContain("同一原牌、原册及两原工具已亲手归还");
    expect(fold("三项实践的原观察与结果").open).toBe(false); await open("三项实践的原观察与结果");
    const history = screen.getByRole("region", { name: "正义导师生活记录" });
    for (const text of ["已实际收束 1 次", "没有本项未结束现场", "本次已收束", "实际经过 44 秒", "本人普通行走 32 米", "已付灵性 6", "原灯油实耗 1"])
      expect(history.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps death, injuries and the independent surviving opponent as read-only facts", async () => {
    const value = projection({ promoted: true, acting: 100, actions: [] });
    value.resources!.health = 0; value.encounter.status = "LOST";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).toContain("本周目已经死亡，原记录只读保留");
    expect(screen.getByRole("region", { name: "正义导师当前目标" }).textContent).not.toContain("可以继续普通生活");
    expect(screen.getByRole("region", { name: "正义导师当前资源" }).textContent).toContain("0 / 100");
    await open("新原人的可选冲突");
    expect(screen.getByRole("region", { name: "正义导师原人遭遇" }).textContent).toContain("健康 90");
    expect(screen.queryByRole("button", { name: /重新交战|复活|恢复精力/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});


describe("JusticeMentorPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [] }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["序列3正义导师已核实；新增技能未原核，当前两项合作与核实技巧为本作G。下一序列2逐光者（古称逐日者）据卷末作者总结，尚未开放。", "序列3正义导师当前只开放两项有限合作与核实技巧，具体效果以当前说明为准。下一序列2逐光者（古称逐日者）仍须另行晋升，本页不直接授予其能力。"],
      ["第五部第88章《收获》直接明确序列3正义导师。完整配方、材料用量、调配顺序、新增技能名录及正义导师晋升仪式仍未核实，不能据此断言不需仪式。下一序列2逐光者（古称逐日者）来自第五部卷末作者总结，能力未核且本阶段不开放。", "序列3正义导师当前渠道只提供独立成品，不提供完整配方、材料用量或调配顺序；晋升仍须完成专业准备，可用技巧以当前说明为准。下一序列2逐光者（古称逐日者）仍须另行晋升，本页不直接授予其能力。"],
      ["。独立成品渠道、专业支持与以上全部数值均为本作G，不冒充原著完整配方或晋升仪式。", "。独立成品渠道、专业支持与以上全部数值以当前说明为准；服药前仍须完成本次专业准备。"],
      ["旧序列4的情感剥离与回输仪式不会作为本阶任务重做。已回输的同一原情感和六种原材料去向只读保留；专业准备不代替尚未核实的3级原著仪式。", "旧序列4的情感剥离与回输仪式不会作为本阶任务重做。已回输的同一原情感和六种原材料去向只读保留；序列3服药前仍须完成本次专业准备。"],
      ["第五部第88章《收获》只直接核实序列3正义导师称号。本次没有核实其完整新增技能名录或定量；共享光辉与清晰标记均是本作借太阳低阶根基拓展的原创G技巧，不冒充原文技能。", "序列3正义导师当前开放共享光辉与清晰标记两项有限技巧，沿用太阳途径低阶能力的基础；具体范围、强度与消耗以当前说明为准。"],
      ["第三案使用继承的序列4净化，成功实际作用并报告只增加旧净化掌握8，不增加两项G新技巧掌握。友善灵也可能受太阳作用伤害，须取得本次同意并真实退到界外，不自动免疫或召回。", "第三案使用继承的序列4净化，成功实际作用并报告只增加旧净化掌握8，不增加两项新技巧掌握。友善灵也可能受太阳作用伤害，须取得本次同意并真实退到界外，不自动免疫或召回。"],
      ["继承序列6公证签名仍须本人认可；没有强制契约、善恶雷达、法律身份或依名称即死。下一2逐光者的名称依据属于第五部卷末作者总结，古称逐日者，能力未核且不开放。", "继承序列6公证签名仍须本人认可；没有强制契约、善恶雷达、法律身份或依名称即死。下一序列2逐光者（古称逐日者）仍须另行晋升，本页不直接授予其能力。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(paragraphs.some(text => text.startsWith(`当次准备：${value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}`))).toBe(true);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
