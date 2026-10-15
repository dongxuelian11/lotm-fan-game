/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeHeadedTemplarPanel, type ThreeHeadedTemplarPanelProps } from "../../src/renderer/ThreeHeadedTemplarPanel";
import type { ThreeHeadedTemplarAction, ThreeHeadedTemplarCommand, ThreeHeadedTemplarProjection } from "../../src/domain/three-headed-templar/types";
import { THREE_HEADED_TEMPLAR_ABILITIES, THREE_HEADED_TEMPLAR_CONSUMPTION_RISK, THREE_HEADED_TEMPLAR_FORMULA_STATUS, THREE_HEADED_TEMPLAR_SOURCE_STATUS } from "../../src/domain/three-headed-templar/content";
import { createThreeHeadedTemplarLifeState, validateThreeHeadedTemplarActivityCommand } from "../../src/domain/three-headed-templar/life";
import { validateThreeHeadedTemplarAcquisitionCommand } from "../../src/domain/three-headed-templar/index";
import { validateThreeHeadedTemplarEncounterCommand } from "../../src/domain/three-headed-templar/encounter";

type Attempt = NonNullable<ThreeHeadedTemplarProjection["life"]["currentAttempt"]>;
type CaseId = ThreeHeadedTemplarProjection["life"]["cases"][number]["id"];
type Spirit = ThreeHeadedTemplarProjection["life"]["spirits"][number];
const action = (command: ThreeHeadedTemplarCommand, label: string, cost = "0行动", extra: Partial<Omit<ThreeHeadedTemplarAction, "command">> = {}): ThreeHeadedTemplarAction => {
  expect(validateThreeHeadedTemplarAcquisitionCommand(command) || validateThreeHeadedTemplarActivityCommand(command) || validateThreeHeadedTemplarEncounterCommand(command)).toBe(true);
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
};
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取三首圣堂专业指导", "1行动 · 500便士");
const consume = (id = "three-headed-templar-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");
const release = (id: Spirit["id"] = "THT3-HELENA") => action({ type: "RELEASE_GRAZED", spiritId: id, confirmed: true }, `永久释放${id}`, "0行动 · 不可逆");

// These typed public fixtures isolate rendering and exact commands. They do not claim
// valid campaign saves, natural check success, acquired spirits or completed gameplay.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 105, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", startSecond: 0, elapsedSeconds: 0,
    initialSpiritHistory: { "THT3-HELENA": 0, "THT3-ROLAND": 0 }, finalSpiritHistory: { "THT3-HELENA": 0, "THT3-ROLAND": 0 },
    steps: [], playerMoves: [], playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, maintenancePayments: 0, performances: 0,
    ownerConsent: "UNASKED", cardTaken: false, cardReturned: false, cardRead: false, farSealRead: false, leftSecured: false, rightChecked: false,
    lightOpened: false, lightClosed: false, helenaInterrupted: false, rolandContinued: false, simultaneousCare: false, abilityUsed: false,
    evidence: [], withdrawn: false, inspected: false, closed: false, result: "NONE", ...extra };
}
function life(): ThreeHeadedTemplarProjection["life"] {
  const state = createThreeHeadedTemplarLifeState();
  return { ...state, title: "有限双灵外放实践G", story: "同一原灵沿真实路径行动。", environment: "原站至A4米、B8米。", nextStep: "先取得本案原主同意。", preferredActionId: null,
    spirits: [], inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["本人实际在START；原卡THT3-CARD在原桌上。"],
    cases: ([
      { id: "two-end-seal", title: "原封条两端核对", story: "原灵到场观察后有限回报，普通方案由本人步行核实。" },
      { id: "paired-care", title: "两处同时照料", story: "原灵分别在A/B付费照看，普通方案依次本人照料。" },
      { id: "interrupted-light", title: "光场中断与原路收回", story: "原强光只中断受影响一灵，原路返回。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): ThreeHeadedTemplarProjection["encounter"] {
  return { title: "布拉姆的原场冲突G", story: "同一原布拉姆、原棍和有限灵性。", status: "AVAILABLE", inside: false, scene: null, enemy: null, actions: [],
    facts: ["4米净空原场与普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<ThreeHeadedTemplarProjection> = {}): ThreeHeadedTemplarProjection {
  return { title: "三首圣堂与有限双灵外放", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限双灵外放G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `three-headed-templar-potion-${n}`, title: `三首圣堂第${n}独立原瓶`, source: `THT3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `three-headed-templar-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对原灵与隔离记录", completedWeek: 101 }, { taskId: "CHECK_LIMITS", title: "核验有限外放范围", completedWeek: 102 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 103 }],
    preparedWeek: null, abilities: THREE_HEADED_TEMPLAR_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原黑骑士消化100，晋升后已满12整周。", pollution: 3,
    risk: THREE_HEADED_TEMPLAR_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原血肉储备2/3、原包SH5-PACKET-1已耗用，SH5-PACKET-2实际持有；原伊芮斯实际放牧，已选轻触与防护，当前驱使1灵。",
    inheritedHistory: ["秘祈人至黑骑士六阶段原记录保持。", "原塞德里克永久释放，不能重得；原加里克H40/S5投降。", "旧不受控影体永久隔离，原灯罩破损，原桶与剩余封条保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "本人START至A4米、B8米；须实际归还原物和收回原灵。", ...extra };
}
function withSources(value: ThreeHeadedTemplarProjection) {
  value.life.metSpiritsWeek = 104; value.life.spirits = Object.values(createThreeHeadedTemplarLifeState().spirits); return value;
}
function acquired(value: ThreeHeadedTemplarProjection, id: Spirit["id"] = "THT3-HELENA", extra: Partial<Spirit> = {}): Spirit {
  if (!value.life.spirits.length) withSources(value);
  const spirit = value.life.spirits.find(entry => entry.id === id)!;
  Object.assign(spirit, { status: "GRAZED", acquiredWeek: 104, attemptWeek: 104, selectedAbilities: [...spirit.knownAbilities], spirituality: 21, integrity: 80, location: "INTERNAL", ...extra }); return spirit;
}
function activate(value: ThreeHeadedTemplarProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === id)!; entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<ThreeHeadedTemplarPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<ThreeHeadedTemplarPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择三首圣堂事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("ThreeHeadedTemplarPanel isolated public preparation", () => {
  it("leads with one current objective, actual resources and the public disabled reason", () => {
    const reason = "原黑骑士只有11/12整周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假配方", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "三首圣堂与有限双灵外放" })); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "三首圣堂当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "三首圣堂当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button(guidance().label).disabled).toBe(true); expect(button(guidance().label).getAttribute("aria-describedby")).toContain("three-headed-templar-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原灵、原储备与旧倒吊人路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假配方")).toBeNull(); fireEvent.click(button(guidance().label)); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows projected preparation ahead of optional bottle work", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "标明原容器与普通出口", "1行动"), work = action({ type: "POTION_WORK", bottleId: "three-headed-templar-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "三首圣堂下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects an independent bottle locally and sends only that original's exact action once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "three-headed-templar-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "three-headed-templar-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:three-headed-templar-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews the exact original bottle, costs, unknown ritual and four risks with keyboard cancellation", async () => {
    const first = consume(), second = consume("three-headed-templar-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 104 });
    const { onCommand, onClose } = panel(value); await userEvent.selectOptions(picker(), "bottle:three-headed-templar-potion-2"); await userEvent.click(button(second.label));
    const review = screen.getByRole("region", { name: "三首圣堂原瓶服用确认" }); expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "三首圣堂第2独立原瓶" }));
    for (const text of ["three-headed-templar-potion-2", "THT3-SEAL-2", "73%", "第104周", "140便士不退", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "完整配方尚未掌握，服用前需要专业准备", "未取得的半神灵不会自动入库", "不开放自制"]) expect(review.textContent).toContain(text);
    expect(within(review).queryByText(THREE_HEADED_TEMPLAR_FORMULA_STATUS)).toBeNull();
    expect(review.textContent).not.toContain("THT3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "三首圣堂原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button(second.label)); expect(onClose).not.toHaveBeenCalled();
  });

  it("retains one original consumed intent through save failure and unlocks only a changed saved projection", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 104 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button(entry.label)); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before);
    rerender(<ThreeHeadedTemplarPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "三首圣堂原瓶服用确认" })).toBeTruthy();
    rerender(<ThreeHeadedTemplarPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<ThreeHeadedTemplarPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "三首圣堂原瓶服用确认" })).toBeNull(); expect(button("关闭三首圣堂页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks new commands, selection and local close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button(guidance().label)); fireEvent.click(button("关闭三首圣堂页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button(guidance().label).disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("shows a nonretryable save error as reload-only and never generates a replacement intent", () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value, { error: { message: "原操作存档不可恢复", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    fireEvent.click(button(guidance().label)); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("invalidates unsubmitted bottle review when actual resources or eligibility change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button(entry.label)); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<ThreeHeadedTemplarPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "三首圣堂原瓶服用确认" })).toBeNull(); expect(button(entry.label).disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });
});

describe("ThreeHeadedTemplarPanel original spirit sources and irreversible release", () => {
  it("shows only projected sources, with sealed originals separate from acquired inventory", () => {
    const value = withSources(projection({ promoted: true, actions: [], preferredActionId: null })), before = structuredClone(value); panel(value);
    const sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" });
    for (const text of ["新来源实际可用 0 位", "实际外放 0 / 2", "赫莲娜·奎因", "生前54岁", "罗兰·维克", "生前61岁", "THT3-HELENA-DEATH", "THT3-ROLAND-DEATH", "THT3-HELENA-CASKET", "THT3-ROLAND-CASKET", "THT3-MARA", "尚未取得，不能外放或协作", "0 / 30", "100 / 100"]) expect(sources.textContent).toContain(text);
    expect(within(sources).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("does not invent source identities or free spirits before an actual projected meeting", () => {
    const ordinary = action({ type: "PREPARE", caseId: "two-end-seal", method: "ORDINARY" }, "本人普通步行核对", "1行动"), value = projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id });
    const { onCommand } = panel(value), sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }); expect(sources.textContent).toContain("尚无可见的已会面来源");
    expect(sources.textContent).not.toContain("赫莲娜·奎因"); expect(sources.textContent).not.toContain("罗兰·维克"); expect(screen.queryByRole("button", { name: /外放原灵/ })).toBeNull();
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("reviews the original casket and the exact selected one-method grazing action before paying", async () => {
    const entry = action({ type: "GRAZE", spiritId: "THT3-HELENA", abilityIds: ["SIGNAL"], confirmed: true }, "选择赫莲娜的有限信号并风险放牧", "1行动 · 6灵性 · 2精神 · 知识18"), value = withSources(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }));
    value.life.spirits[0]!.preparedWeek = 105; const before = structuredClone(value), { onCommand } = panel(value); await userEvent.click(button(entry.label));
    const review = screen.getByRole("region", { name: "三首圣堂原灵放牧确认" });
    for (const text of ["THT3-HELENA-CASKET", "THT3-HELENA-DEATH", "本次明确选择：有限信号", "180便士", "失败仍耗尽本周准备", "下一真实周"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("确认尝试放牧这一原灵")); fireEvent.click(button("确认尝试放牧这一原灵")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
  });

  it("keeps failed grazing costs and the same sealed original without granting selected methods", async () => {
    const value = withSources(projection({ promoted: true, actions: [], preferredActionId: null })), spirit = value.life.spirits[0]!;
    spirit.attemptWeek = 105; spirit.history = [{ type: "GRAZE", spiritId: spirit.id, week: 105, round: null, atSecond: 0, context: "week:105", tier: "FAILURE", abilityIds: ["SIGNAL"], destination: "SEALED", method: null, seconds: 0, metres: 0, masterCost: 6, spiritCost: 0, mindCost: 2, cashCost: 0 }];
    panel(value); await open("赫莲娜·奎因的原方法与实际消耗记录"); const sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" });
    for (const text of ["原灵仍封存，尚未取得", "原尝试周：105", "失败", "主人实耗灵性6、精神2", "新来源实际可用 0 位", "尚未选择或取得"]) expect(sources.textContent).toContain(text);
    expect(spirit.selectedAbilities).toEqual([]); expect(spirit.spirituality).toBe(0);
  });

  it("shows actual acquired spirit resources, chosen methods and paid travel without refreshing them", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); acquired(value, "THT3-HELENA", { selectedAbilities: ["SIGNAL"], spirituality: 12, integrity: 60, location: "B", travelMetres: 12, interrupted: true });
    const before = structuredClone(value); panel(value); const sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" });
    for (const text of ["新来源实际可用 1 位", "实际外放 1 / 2", "12 / 30", "60 / 100", "有限信号（SIGNAL）", "原处B", "原路径累计 12 米", "已受强光中断"]) expect(sources.textContent).toContain(text);
    expect(value).toEqual(before);
  });

  it("requires an independent irreversible release review and Escape restores its trigger", async () => {
    const entry = release(), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id }); acquired(value); const before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button(entry.label)); const review = screen.getByRole("region", { name: "三首圣堂永久释放确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "赫莲娜·奎因" }));
    for (const text of ["THT3-HELENA", "THT3-HELENA-CASKET", "21 / 30", "80 / 100", "永久释放", "不能从同一来源重新取得", "不会获赠替代灵", "和永久释放不同"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "三首圣堂永久释放确认" })).toBeNull(); expect(document.activeElement).toBe(button(entry.label)); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("submits release exactly once and locks the same irreversible intent across save failure", async () => {
    const entry = release("THT3-ROLAND"), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id }); acquired(value, "THT3-ROLAND"); const { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button(entry.label)); fireEvent.click(button("确认永久释放这一原灵")); fireEvent.click(button("确认永久释放这一原灵")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command);
    rerender(<ThreeHeadedTemplarPanel {...defaults} error={{ message: "释放写入失败", retryable: true }} />); expect(button("确认永久释放这一原灵").disabled).toBe(true); expect(button("暂不提交，返回原记录").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "三首圣堂永久释放确认" })).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("不要重复付费、服药、放牧、释放");
    const saved = structuredClone(value), spirit = saved.life.spirits.find(entry => entry.id === "THT3-ROLAND")!; spirit.status = "RELEASED"; spirit.location = "RELEASED"; spirit.releasedWeek = 105; saved.actions = []; saved.preferredActionId = null;
    rerender(<ThreeHeadedTemplarPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "三首圣堂永久释放确认" })).toBeNull(); expect(screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }).textContent).toContain("这一次永久释放已经保存"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("invalidates release review if the original is no longer internally available", async () => {
    const entry = release(), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id }); acquired(value); const { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button(entry.label)); const changed = structuredClone(value); changed.life.spirits[0]!.location = "A"; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须先按4米原路收回原灵。";
    rerender(<ThreeHeadedTemplarPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "三首圣堂永久释放确认" })).toBeNull(); expect(button(entry.label).disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["RELEASED", "DISSIPATED"] as const)("preserves terminal original %s records without new inventory or a resurrection action", status => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); const spirit = acquired(value, "THT3-HELENA", { status, location: status, releasedWeek: status === "RELEASED" ? 105 : null, integrity: status === "DISSIPATED" ? 0 : 80 });
    const before = structuredClone(value); panel(value); const sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }); expect(sources.textContent).toContain("新来源实际可用 0 位"); expect(sources.textContent).toContain(status === "RELEASED" ? "不可重新取得" : "不能复活");
    expect(within(sources).queryByRole("button")).toBeNull(); expect(spirit.selectedAbilities).toHaveLength(3); expect(value).toEqual(before);
  });
});

describe("ThreeHeadedTemplarPanel actual cases, limited information and cleanup", () => {
  it("pins an active case and includes the actually projected spirit action", () => {
    const entry = action({ type: "EXTERNALIZE", spiritId: "THT3-HELENA" }, "尝试外放同一赫莲娜", "4灵性 · 2精神 · 知识18"), value = activate(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }), "paired-care", attempt({ ownerConsent: "GRANTED", cardTaken: true }));
    acquired(value); const before = structuredClone(value), { onCommand } = panel(value); expect(picker().value).toBe("case:paired-care"); expect(picker().disabled).toBe(true);
    const current = screen.getByRole("region", { name: "三首圣堂当前行动" }), sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }); expect(current.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button(entry.label)); fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before); expect(value.life.spirits[0]!.location).toBe("INTERNAL");
  });

  it.each([
    [{ type: "SEND_SPIRIT", spiritId: "THT3-HELENA", destination: "B" }, "派同一赫莲娜走到B"],
    [{ type: "ASSIST", spiritId: "THT3-ROLAND", method: "STEADY_HOLD" }, "罗兰付3灵性稳住原箱"],
    [{ type: "RECALL_SPIRIT", spiritId: "THT3-HELENA" }, "沿8米原路收回赫莲娜"],
  ] as const)("sends only the selected existing source command %j without replacing an original", (command, label) => {
    const entry = action(command, label), value = activate(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }), "paired-care", attempt({ ownerConsent: "GRANTED", cardTaken: true }));
    acquired(value, "THT3-HELENA", { location: "B" }); acquired(value, "THT3-ROLAND", { location: "A" }); const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("keeps ordinary preparation selectable without spirits and never substitutes the ability method", async () => {
    const ability = action({ type: "PREPARE", caseId: "paired-care", method: "ABILITY" }, "准备两原灵同时照料", "1行动", { enabled: false, reason: "尚未实际取得两位原灵及所需已选方法。" });
    const ordinary = action({ type: "PREPARE", caseId: "paired-care", method: "ORDINARY" }, "本人依次步行照料", "1行动"), value = projection({ promoted: true, actions: [ability, ordinary], preferredActionId: ordinary.id });
    const before = structuredClone(value), { onCommand } = panel(value); expect(screen.getByRole("region", { name: "当前三首圣堂生活情境" }).textContent).toContain("普通报告与反思可到扮演100");
    await open("其它步骤与未满足条件"); expect(button(ability.label).disabled).toBe(true); fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it("does not invent a report or successful observation before public evidence exists", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "two-end-seal", attempt()), before = structuredClone(value); panel(value);
    const facts = screen.getByRole("region", { name: "三首圣堂原人原物与真实位置" }); expect(facts.textContent).toContain("尚无实际观察或回报；没有未来答案"); expect(facts.textContent).toContain("本次尚无实际外放能力使用记录"); expect(facts.textContent).toContain("原主许可：尚未询问");
    expect(facts.textContent).not.toContain("两原灵曾分别实际在A/B同时照料"); expect(value).toEqual(before);
  });

  it("shows only actual limited observation, the same carried card and real player route", () => {
    const back = action({ type: "WALK_A", caseId: "two-end-seal" }, "本人带原卡走4米回A", "0行动 · 4米4秒");
    const current = attempt({ method: "ORDINARY", ownerConsent: "GRANTED", cardTaken: true, cardRead: true, farSealRead: true, playerTravelMetres: 8, elapsedSeconds: 18,
      playerMoves: [{ from: "START", to: "A", metres: 4, seconds: 4, itemIds: ["THT3-CARD"] }, { from: "A", to: "B", metres: 4, seconds: 4, itemIds: ["THT3-CARD"] }],
      evidence: [{ sourceId: "THT3-FAR-SEAL", text: "本人到B只看清原封条的外侧编号。", atSecond: 18 }] });
    const value = activate(projection({ promoted: true, actions: [back], preferredActionId: back.id }), "two-end-seal", current); value.life.playerLocation = "B"; value.life.card.location = "PLAYER"; value.life.card.travelMetres = 8;
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "三首圣堂原人原物与真实位置" });
    for (const text of ["本人实际在B", "THT3-CARD在本人手中", "第18秒 · 原件THT3-FAR-SEAL", "只看清原封条的外侧编号", "A → B：本人实际行走 4 米、4 秒", "携行原物 THT3-CARD", "本次尚无实际外放能力使用记录"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
  });

  it("keeps actual zero-resource recall, return, shutter cleanup and disabled close visible", () => {
    const recall = action({ type: "RECALL_SPIRIT", spiritId: "THT3-HELENA" }, "沿8米原路收回受光原灵", "0行动 · 0灵性 · 8米8秒"), shutter = action({ type: "CLOSE_SHUTTER", caseId: "interrupted-light" }, "关回原遮板", "0行动"), card = action({ type: "RETURN_CARD", caseId: "interrupted-light" }, "归还唯一原卡", "0行动", { enabled: false, reason: "须本人先走回A原桌。" });
    const close = action({ type: "CLOSE", caseId: "interrupted-light" }, "收束本次原现场", "0行动", { enabled: false, reason: "原灵仍在B，原卡未归还、原遮板仍打开。" });
    const value = activate(projection({ promoted: true, actions: [recall, shutter, card, close], preferredActionId: recall.id }), "interrupted-light", attempt({ cardTaken: true, lightOpened: true, helenaInterrupted: true, ownerConsent: "GRANTED", spiritualitySpent: 8, mindSpent: 4 }));
    acquired(value, "THT3-HELENA", { location: "B", spirituality: 3, integrity: 60, interrupted: true }); acquired(value, "THT3-ROLAND", { location: "A", spirituality: 18, integrity: 100 });
    value.resources!.spirituality = 0; value.resources!.mind = 0; value.resources!.actionsRemaining = 0; value.life.card.location = "PLAYER"; value.life.lamp.on = true; value.life.shutter.state = "OPEN";
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(recall.label).disabled).toBe(false); expect(button(shutter.label).disabled).toBe(false); expect(button(card.label).disabled).toBe(true); expect(button(close.label).disabled).toBe(true);
    for (const entry of [shutter, card, close]) expect(button(entry.label).closest("details")).toBeNull(); const facts = screen.getByRole("region", { name: "三首圣堂原人原物与真实位置" });
    for (const text of ["THT3-LAMP实际开启", "THT3-SHUTTER实际打开", "赫莲娜原灵实际受到强光中断", "已付灵性 8、精神 4"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(close.label)); expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button(recall.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(recall.command); expect(value).toEqual(before);
  });

  it("keeps actual dual presence, individual costs and one interrupted source distinct", async () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "interrupted-light", attempt({ ownerConsent: "GRANTED", cardTaken: true, abilityUsed: true, helenaInterrupted: true, rolandContinued: true, spiritualitySpent: 9, mindSpent: 4, maintenancePayments: 1, elapsedSeconds: 25 }));
    acquired(value, "THT3-HELENA", { location: "INTERNAL", spirituality: 18, integrity: 80 }); const roland = acquired(value, "THT3-ROLAND", { location: "A", spirituality: 15, integrity: 100 });
    roland.history.push({ type: "ASSIST", spiritId: roland.id, week: 105, round: null, atSecond: 25, context: "interrupted-light", tier: null, abilityIds: [], destination: "A", method: "SIGNAL", seconds: 1, metres: 0, masterCost: 1, spiritCost: 3, mindCost: 0, cashCost: 0 });
    panel(value); await open("罗兰·维克的原方法与实际消耗记录"); const sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }), facts = screen.getByRole("region", { name: "三首圣堂原人原物与真实位置" });
    for (const text of ["实际外放 1 / 2", "18 / 30", "15 / 30", "原灵实耗灵性3", "主人实耗灵性1", "原处A"]) expect(sources.textContent).toContain(text);
    expect(facts.textContent).toContain("罗兰原灵在另一处继续了实际协作"); expect(facts.textContent).toContain("实际维持付费1次");
  });

  it("shows ordinary completion and acting100 without inventing new mastery", () => {
    const current = attempt({ method: "ORDINARY", ownerConsent: "CLOSED", cardTaken: true, cardReturned: true, inspected: true, closed: true, result: "ORDINARY", playerTravelMetres: 16, elapsedSeconds: 30 });
    const value = projection({ promoted: true, acting: 100, actions: [], preferredActionId: null }); value.life.cases[0]!.status = "RESOLVED"; value.life.cases[0]!.attempts = [current]; value.life.cases[1]!.status = "RESOLVED"; value.life.cases[2]!.status = "RESOLVED";
    const before = structuredClone(value); panel(value); const facts = screen.getByRole("region", { name: "三首圣堂原人原物与真实位置" });
    for (const text of ["普通方法完成，不计能力使用", "原卡已实际归还", "现场已实际收束", "本次尚无实际外放能力使用记录"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "三首圣堂当前目标" }).textContent).toContain("三首圣堂扮演 100 / 100"); expect(facts.textContent).not.toContain("实际外放协作完成"); expect(value.abilities[0]!.mastery).toBe(0); expect(value).toEqual(before);
  });

  it("closes only the local view without recalling a spirit or cleaning original objects", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "interrupted-light", attempt({ ownerConsent: "GRANTED", cardTaken: true, lightOpened: true }));
    acquired(value, "THT3-HELENA", { location: "B" }); value.life.card.location = "PLAYER"; value.life.shutter.state = "OPEN"; const before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭三首圣堂页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("ThreeHeadedTemplarPanel original encounter and inherited history", () => {
  it("shows the independent original enemy, paid powers and real four-metre peaceful exit", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "本人沿4米原出口离开", "0行动 · 4米4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.scene = { courtId: "THT3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 };
    value.encounter.enemy = { id: "THT3-BRAM", name: "布拉姆·福斯", age: 49, source: "ORIGINAL_LIMITED_G", sequence: 3, health: 100, mind: 100, spirituality: 100, status: "RESISTING", weaponId: "THT3-BRAM-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 2, WARD: 1, LIGHT_BREAK: 1 } };
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "三首圣堂原人遭遇" }); expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    for (const text of ["布拉姆·福斯", "49岁", "THT3-BRAM", "健康 100", "精神 100", "100 / 120", "THT3-BRAM-ROD", "实际弧光 2 次", "屏护 1 次", "强光中断 1 次", "须本人走 4 米", "场内第三人 0", "旧加里克不重新开战"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });

  it("keeps actual court originals and their finite support costs visible before fighting", () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原布拉姆真实冲突", "1行动 · 真实伤亡"), recall = action({ type: "RECALL_SPIRIT", spiritId: "THT3-HELENA" }, "开战前按原路收回赫莲娜", "0行动 · 4米4秒");
    const value = projection({ promoted: true, actions: [fight, recall], preferredActionId: fight.id }); value.encounter.inside = true; value.encounter.status = "READY";
    acquired(value, "THT3-HELENA", { location: "COURT", spirituality: 3, integrity: 40, supportEnabled: true, selectedAbilities: ["BRIEF_WARD"] }); acquired(value, "THT3-ROLAND", { location: "INTERNAL", spirituality: 0, integrity: 80 });
    const before = structuredClone(value), { onCommand } = panel(value), sources = screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" });
    for (const text of ["实际外放 1 / 2", "3 / 30", "40 / 100", "原院COURT", "短暂防护（BRIEF_WARD）", "已在实际外放状态启用，仍逐次付费"]) expect(sources.textContent).toContain(text);
    const facts = screen.getByRole("region", { name: "三首圣堂原人遭遇" }); expect(facts.textContent).toContain("每灵每轮至多1次已选协作，实付自身3灵性与主人1灵性"); expect(facts.textContent).toContain("已经发生并付费的协作不撤销");
    expect(button(recall.label).closest("details")).toBeNull(); fireEvent.click(button(recall.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(recall.command); expect(value).toEqual(before);
  });

  it("retains death and released outside originals without offering a living continuation", () => {
    const entry = action({ type: "ENCOUNTER_FIGHT" }, "再承担原冲突", "1行动", { enabled: false, reason: "本周目已死亡。" }), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id });
    value.resources!.health = 0; value.encounter.status = "LOST"; acquired(value, "THT3-HELENA", { status: "RELEASED", location: "RELEASED", releasedWeek: 105, spirituality: 6, integrity: 60 });
    const before = structuredClone(value), { onCommand } = panel(value); expect(screen.getByRole("region", { name: "三首圣堂当前目标" }).textContent).toContain("本周目已经死亡"); expect(button(entry.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "三首圣堂原灵来源与实际资源" }).textContent).toContain("已永久释放，不能重新取得"); fireEvent.click(button(entry.label)); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps old released Cedric, original Iris, actual reserve and isolated shadow read-only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原灵、原储备与旧倒吊人路线记录"); const history = screen.getByRole("region", { name: "三首圣堂继承记录" });
    for (const text of ["原血肉储备2/3", "SH5-PACKET-1已耗用", "SH5-PACKET-2实际持有", "原伊芮斯实际放牧", "原塞德里克永久释放", "H40/S5投降", "旧不受控影体永久隔离", "原灯罩破损", "不补库存", "不把隔离影体变成宠物"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("preserves exact release limits and implements one ability without a full borrowing library", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "三首圣堂能力与使用范围" });
    for (const text of ["三首圣堂3在本阶段至多外放2位灵", "主人同时仍只借1灵", "原总放牧容量7", "每灵至多3项", "主人一次只借1灵", "本段本人借用仅接原已选伊芮斯", "不开放完整三身体借法库", "收回不会补满", "40便士", "不能复活已消散或已永久释放者"]) expect(scope.textContent).toContain(text);
    expect(THREE_HEADED_TEMPLAR_ABILITIES).toHaveLength(1); expect(THREE_HEADED_TEMPLAR_ABILITIES[0]!.id).toBe("hanged-man.s3.multiple-release");
  });
  it("adapts the authored formula and source paragraphs without mutating the projection", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "三首圣堂成品与配方边界" });
    expect(within(formula).getByText("三首圣堂为倒吊人途径序列3，可以同时外放多于一位半神灵；完整配方尚未掌握，服用前需要专业准备。材料、用量、调配顺序与完整仪式保持未知，仍须完成服药准备。本阶段只有明确三瓶独立成品渠道与实际专业准备；三项核对及当周场地检查不开放自制。")).toBeTruthy();
    expect(within(formula).queryByText(THREE_HEADED_TEMPLAR_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "三首圣堂能力与使用范围" });
    expect(within(scope).getByText("三首圣堂3在本阶段至多外放2位灵，主人同时仍只借1灵；总放牧上限7、每灵至多3个实际已选技能保留。本人借用只沿用旧伊芮斯，两位新半神灵仅支持有限外放协作，不赠送新的本人借用技能库。赫莲娜·奎因（THT3-HELENA，生前54岁）与罗兰·维克（THT3-ROLAND，生前61岁）此前已经死亡，各有不同原死亡记录、原封存容器和玛拉保管记录。须本人会面、同意交接、逐灵实付180便士及1行动准备，再以1行动6灵性2精神、知识18承担风险；失败消耗不返，同一仍封存原灵只可跨真实周重新付费准备再试。成功取得者才可外放，永久释放者不得重新获得，无免费替代灵。原塞德里克永久释放、原伊芮斯实际放牧、旧不受控影体永久隔离和原加里克投降保留。三处生活原案的距离、持续、价格、资源和技能效果见当前说明。")).toBeTruthy();
    expect(within(scope).queryByText(THREE_HEADED_TEMPLAR_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before);
  });

});

describe("ThreeHeadedTemplar exact static copy", () => {
  it("retains two released spirits, one borrowed spirit and independent paid containers", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    const goal = screen.getByRole("region", { name: "三首圣堂当前目标" });
    expect(within(goal).getByText("三首圣堂在本阶段至多同时外放2位灵，主人同时仍只借1灵；具体范围、成本与数值以当前说明为准。完整配方与晋升仪式细节尚未掌握，服用前仍须完成专业准备。", { exact: true })).toBeTruthy();
    expect(within(goal).queryByText("原核支持突破一次只外放一位半神灵的限制；本作至多2位外放与全部精确范围、成本、数值均为原创G。完整配方与原著晋升仪式未知。", { exact: true })).toBeNull();
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "三首圣堂成品与配方边界" });
    expect(within(formula).getByText("服药前须实际完成三项专业准备并检查当周场地；完整晋升仪式细节尚未掌握。成品原瓶与原灵封存容器独立，购买魔药不会赠送灵魂。", { exact: true })).toBeTruthy();
    expect(within(formula).queryByText("三项专业准备是原创G适配，不充当已核原著仪式。成品原瓶与原灵封存容器独立，购买魔药不会赠送灵魂。", { exact: true })).toBeNull();
    for (const text of ["500便士", "6400便士", "900便士", "12整周", "消化100", "1行动与140便士"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "三首圣堂能力与使用范围" });
    for (const text of ["原总放牧容量7", "每灵至多3项", "主人一次只借1灵", "原已选伊芮斯", "不能复活已消散或已永久释放者"]) expect(scope.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
