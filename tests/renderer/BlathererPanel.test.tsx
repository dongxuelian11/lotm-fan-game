/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlathererPanel, type BlathererPanelProps } from "../../src/renderer/BlathererPanel";
import type { BlathererAction, BlathererCommand, BlathererProjection } from "../../src/domain/blatherer/types";
import { BLATHERER_ABILITIES, BLATHERER_CONSUMPTION_RISK, BLATHERER_FORMULA_STATUS, BLATHERER_SOURCE_STATUS } from "../../src/domain/blatherer/content";
import { createBlathererLifeState, validateBlathererActivityCommand } from "../../src/domain/blatherer/life";
import { validateBlathererAcquisitionCommand } from "../../src/domain/blatherer/index";
import { validateBlathererEncounterCommand } from "../../src/domain/blatherer/encounter";

type Attempt = NonNullable<BlathererProjection["life"]["currentAttempt"]>;
type CaseId = BlathererProjection["life"]["cases"][number]["id"];
const action = (command: BlathererCommand, label: string, cost = "0行动", extra: Partial<Omit<BlathererAction, "command">> = {}): BlathererAction => {
  expect(validateBlathererAcquisitionCommand(command) || validateBlathererActivityCommand(command) || validateBlathererEncounterCommand(command)).toBe(true);
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
};
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取呓语者专业指导", "1行动 · 500便士");
const consume = (id = "blatherer-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Structurally typed, isolated public fixtures test rendering and the exact public command API.
// They do not claim a valid campaign save, a natural promotion, or a successful random replay.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 130, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [],
    spiritualitySpent: 0, mindSpent: 0, resolutionPaid: false, resolutionActions: 0, consent: "UNASKED", withdrawn: false,
    cardRead: false, cardTaken: false, cardReturned: false, bellRead: false, guideLeft: false, whisperTier: null, whisperSourceId: null,
    whisperAtSecond: null, voiceActive: false, stopped: false, residualSeconds: 0, waitedSeconds: 0, waitCompleted: false,
    currentAnswer: null, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function life(): BlathererProjection["life"] {
  const state = createBlathererLifeState();
  return { ...state, title: "三项有限低语实践G", story: "当前听者、当次同意与实际余效分别保存。", environment: "原房间与普通路径。", nextStep: "先取得本次原听者同意。",
    inside: false, insideCase: false, currentAttempt: null, actions: [],
    facts: ["本人在START；尚无实际行走。", "原卡BL3-CARD属于诺拉，须本人实际借还。"],
    cases: ([
      { id: "conflicting-bell", title: "G · 相冲的原铃声", story: "本人实际读原卡并比较原铃记录。" },
      { id: "withdrawn-invitation", title: "G · 撤回的邀请", story: "当事人可撤回本次同意，原卡仍是她的。" },
      { id: "open-corridor", title: "G · 走廊里的旁人", story: "罗安须实际沿8米原路离开，普通核验不施术。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): BlathererProjection["encounter"] {
  return { title: "埃德里克的原场冲突G", story: "原埃德里克、原棍与独立灵性；有限低语本身不致伤。", status: "AVAILABLE", inside: false, scene: null, enemy: null, whisperReady: false, residualSeconds: 0, actions: [],
    facts: ["4米净空原场与普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<BlathererProjection> = {}): BlathererProjection {
  return { title: "呓语者与有限低语", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限低语与实际核验G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `blatherer-potion-${n}`, title: `呓语者第${n}独立原瓶`, source: `BL3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `blatherer-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 110 }, { taskId: "CHECK_LIMITS", title: "核验原房间有限范围", completedWeek: 111 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 112 }],
    preparedWeek: null, abilities: BLATHERER_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原魔鬼消化100，晋升后已满12整周。", pollution: 3,
    risk: BLATHERER_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原DV4-PROGRAM-1、DV4-INVITATION-1与原棍记录保留；旧库存不补回。",
    inheritedHistory: ["罪犯、折翼天使、连环杀手、恶魔、欲望使徒与魔鬼六阶段原记录保持。", "原奥里克仍投降H70/S32，一处原重伤和旧紧绷3保持。", "旧掌握0保留，旧种子不转给埃德里克。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "本人START至A实走4米，至B实走8米；原物须本人实际带回。", ...extra };
}
function activate(value: BlathererProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current; value.life.facts = [];
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<BlathererPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<BlathererPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择呓语者事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("BlathererPanel isolated public projections and exact saved commands", () => {
  it("leads with one current objective, visible resources and the public disabled reason", () => {
    const reason = "原魔鬼只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "呓语者与有限低语" })); expect(screen.getByRole("region", { name: "呓语者" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "呓语者当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "呓语者当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取呓语者专业指导").disabled).toBe(true); expect(button("听取呓语者专业指导").getAttribute("aria-describedby")).toContain("blatherer-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧深渊路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取呓语者专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected preparation objective ahead of optional bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下本人实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "blatherer-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "呓语者下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects a different original bottle locally and submits only its exact labour command once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "blatherer-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "blatherer-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:blatherer-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews the selected original, 140-cost preparation, unknown ritual and four risks before consumption", async () => {
    const first = consume(), second = consume("blatherer-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 113 });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:blatherer-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "呓语者原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "呓语者第2独立原瓶" }));
    for (const text of ["blatherer-potion-2", "BL3-SEAL-2", "73%", "第113周", "140便士不退", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "完整仪式均保持未知", "独立成品渠道与专业支持"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("BL3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the original confirmed intent locked through save failure without recharging or retrying locally", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<BlathererPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "呓语者原瓶服用确认" })).toBeTruthy();
    rerender(<BlathererPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<BlathererPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull();
    expect(button("关闭呓语者页面").disabled).toBe(false); expect(picker().value).toBe("case:conflicting-bell"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks new commands, selection and local close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取呓语者专业指导")); fireEvent.click(button("关闭呓语者页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取呓语者专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted bottle review when the saved resources or eligibility change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<BlathererPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("switches unstarted cases locally without showing three equal action walls", async () => {
    const first = action({ type: "OBSERVE", caseId: "conflicting-bell" }, "观察原铃架"), second = action({ type: "OBSERVE", caseId: "open-corridor" }, "观察原仪器边界");
    const value = projection({ promoted: true, actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "case:open-corridor"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察原铃架/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前呓语者生活情境" }).textContent).toContain("实际沿8米原路离开"); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(value).toEqual(before);
  });

  it("submits ordinary preparation without automatically requesting or resolving a whisper", () => {
    const ordinary = action({ type: "PREPARE", caseId: "conflicting-bell", method: "ORDINARY" }, "准备普通核查", "1行动"), value = projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id });
    value.life.cases[0]!.status = "OBSERVED"; const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "当前呓语者生活情境" }).textContent).toContain("进入原现场不自动施术"); fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("button", { name: /WHISPER/ })).toBeNull();
  });

  it("keeps unknown recipe and original-G support separate from the one new finite ability", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("独立成品与晋升准备"); const formula = screen.getByRole("region", { name: "呓语者成品与配方边界" });
    for (const text of ["完整配方", "完整仪式", "尚未掌握", "罗安·费里", "6400", "900便士", "140便士", "12整周", "推测祭坛", "不开放自制配方"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "呓语者能力与使用范围" });
    for (const text of ["掌握 0", "知识18", "4灵性", "1精神", "失败", "当前", "6米", "撤回同意", "0直接伤害", "不叠加", "失败照付"]) expect(scope.textContent).toContain(text);
    expect(BLATHERER_ABILITIES).toHaveLength(1); expect(BLATHERER_ABILITIES[0]!.id).toBe("abyss.s3.limited-murmur");
  });

  it("preserves original tools, surrendered Orrick and paid strain history read-only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原人物、原物与旧深渊路线记录"); const history = screen.getByRole("region", { name: "呓语者继承记录" });
    for (const text of ["DV4-PROGRAM-1", "DV4-INVITATION-1", "原奥里克仍投降", "H70/S32", "旧紧绷3", "旧掌握0", "不补库存", "旧种子不转"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before); expect(history.textContent).not.toContain("年轻外观");
  });
});

describe("BlathererPanel keeps local navigation separate from saved actions", () => {
  it("labels the candidate name and S3 mapping as inference before any optional detail", () => {
    panel();
    const summary = screen.getByRole("region", { name: "呓语者当前目标" });
    for (const text of ["魔鬼4", "呓语者为深渊序列3", "只开放有限低语", "服用前须完成专业准备", "以当前说明为准"]) expect(summary.textContent).toContain(text);
  });

  it("pins a prepared original case instead of switching to an unrelated preferred command", () => {
    const enter = action({ type: "START_CASE", caseId: "withdrawn-invitation" }, "本人进入原邀请现场"), other = action({ type: "OBSERVE", caseId: "conflicting-bell" }, "观察另一个原案");
    const value = projection({ promoted: true, actions: [other, enter], preferredActionId: other.id });
    value.life.cases[1]!.status = "PREPARED"; value.life.cases[1]!.method = "ABILITY";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(picker().value).toBe("case:withdrawn-invitation"); expect(picker().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /^观察另一个原案/ })).toBeNull();
    fireEvent.click(button(enter.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(enter.command); expect(value).toEqual(before);
  });

  it("selects actual future-batch supply commands without treating a week as a free bottle", () => {
    const request = action({ type: "REQUEST_SUPPLY" }, "申请下一真实周的新批原瓶", "1行动"), value = projection({ actions: [request], preferredActionId: request.id });
    value.bottles.forEach(entry => { entry.status = "原瓶已耗尽 · 排异失败"; });
    const { onCommand } = panel(value);
    expect(picker().value).toBe("preparation"); fireEvent.click(button(request.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(request.command);
    expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull();
  });

  it("does not turn an unavailable consume command into a local confirmation or potion use", () => {
    const original = { ...consume(), enabled: false, reason: "当前精神40，须高于40；先实际休养。" };
    const { onCommand } = panel(projection({ actions: [original], preferredActionId: original.id }));
    expect(button("核对并服用").disabled).toBe(true); fireEvent.click(button("核对并服用"));
    expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("invalidates a review if an action ID is reused for a different original bottle", async () => {
    const original = consume(), value = projection({ actions: [original], preferredActionId: original.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    const changed = structuredClone(value); changed.actions[0] = { ...consume("blatherer-potion-2"), id: original.id };
    rerender(<BlathererPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "呓语者原瓶服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("drops a stale local bottle goal when the saved projection advances to the promoted phase", async () => {
    const value = projection(), { defaults, rerender, onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:blatherer-potion-2");
    const saved = structuredClone(value); saved.promoted = true; saved.actions = []; saved.preferredActionId = null;
    rerender(<BlathererPanel {...defaults} value={saved} />);
    expect(picker().value).toBe("case:conflicting-bell"); expect(screen.queryByRole("region", { name: "当前独立呓语者原瓶" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("allows local close to remain separate from an invented scene cleanup command", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭呓语者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "呓语者当前行动" }).textContent).toContain("当前没有可提交的公开行动");
  });

  it("does not submit an enabled stale action for a dead body, while its history can still close", () => {
    const value = projection(); value.resources!.health = 0;
    const { onCommand, onClose } = panel(value);
    expect(screen.getByRole("region", { name: "呓语者当前目标" }).textContent).toContain("本周目已经死亡");
    expect(button("听取呓语者专业指导").disabled).toBe(true); fireEvent.click(button("听取呓语者专业指导")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("关闭呓语者页面")); expect(onClose).toHaveBeenCalledOnce();
  });
});

function court(extra: Partial<BlathererProjection["encounter"]> = {}): BlathererProjection["encounter"] {
  return { ...encounter(), status: "READY", inside: true,
    enemy: { id: "BL3-EDRIC", name: "埃德里克·凯尔", age: 48, sequence: 4, source: "ORIGINAL_LIMITED_G", health: 70, mind: 100, spirituality: 3,
      status: "RESISTING", weaponId: "BL3-EDRIC-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 9, WARD: 18 }, breathUses: 2 },
    scene: { courtId: "BL3-COURT", targetAwake: true, targetListening: true, ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true,
      playerPosition: "COURT", distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 },
    facts: ["原恶魔紧绷3保留，资源不足须普通回退，不会免费复制新来源。"], ...extra };
}

describe("BlathererPanel shows the distinct original opponent and finite combat effect", () => {
  it("pins the actual court and renders Edric's remaining resources and independently paid actions", () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原院落真实冲突", "1行动"), value = projection({ promoted: true, actions: [fight], preferredActionId: fight.id, encounter: court() });
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "呓语者原人遭遇" });
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    for (const text of ["BL3-EDRIC", "埃德里克·凯尔", "48岁", "序列4", "健康 70", "3 / 120", "BL3-EDRIC-ROD", "实际弧光 9", "屏护 18", "集中呼吸 2", "紧绷3", "普通回退"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "呓语者原战场与真实退路" }).textContent).toContain("原听者当前清醒、实际可听");
    expect(screen.getByRole("region", { name: "呓语者当前行动" }).compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button(fight.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(value).toEqual(before);
  });

  it("shows a current one-use effect and actual residual without inventing a local clear button", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: court({ status: "FIGHTING", whisperReady: true, residualSeconds: 30 }) }), before = structuredClone(value);
    const { onCommand } = panel(value), effect = screen.getByRole("region", { name: "呓语者战斗当前有限低语" });
    for (const text of ["本回合", "BODY或ARC", "减半一次", "尚未消费", "不叠加", "余留 30 秒", "实际等待"]) expect(effect.textContent).toContain(text);
    expect(within(effect).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("submits only the projected ordinary leave command and never auto-starts combat", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原普通出口和平离开", "0行动 · 4米4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id, encounter: court() });
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button(leave.label)); fireEvent.click(button(leave.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("preserves the saved court and original command when an ordinary exit fails to save", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口离开"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id, encounter: court() });
    const { defaults, rerender, onCommand } = panel(value); fireEvent.click(button(leave.label));
    rerender(<BlathererPanel {...defaults} error={{ message: "离场保存失败", retryable: false }} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载"); expect(screen.getByRole("region", { name: "呓语者原战场与真实退路" }).textContent).toContain("本人实际在原场内");
    expect(button(leave.label).disabled).toBe(true); expect(button("关闭呓语者页面").disabled).toBe(true); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("does not present a dead original opponent or an exited player as a current listening target", async () => {
    const ended = court({ status: "RESOLVED", inside: false });
    ended.enemy!.status = "DEAD"; ended.enemy!.health = 0; ended.enemy!.weaponLocation = "COURT";
    ended.scene!.playerPosition = "EXIT"; ended.scene!.ordinaryWalkedMetres = 4; ended.scene!.targetAwake = false; ended.scene!.targetListening = false;
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: ended }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "encounter"); const facts = screen.getByRole("region", { name: "呓语者原人遭遇" });
    for (const text of ["原身体已死亡", "留在原场", "实际在出口", "累计普通离场 4 米", "不表示当前还能施术", "当前没有待消费"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("原听者当前清醒"); expect(within(facts).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("BlathererPanel renders current consent, paid failures and real cleanup", () => {
  it("pins the current original listener and keeps permission separate from general willingness", () => {
    const ask = action({ type: "CONSENT_NORA", caseId: "conflicting-bell" }, "当面询问本次许可"), value = activate(projection({ promoted: true, actions: [ask], preferredActionId: ask.id }), "conflicting-bell", attempt());
    value.life.playerLocation = "A";
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "呓语者原人原物与真实位置" });
    expect(picker().disabled).toBe(true); expect(picker().value).toBe("case:conflicting-bell");
    for (const text of ["BL3-QUIET-ROOM", "本人实际在A", "诺拉·温特", "46岁", "BL3-NORA", "罗安·费里", "BL3-CARD", "BL3-BELL", "BL3-NOTE", "一般愿意参与不等于本案当前同意", "当前许可：尚未询问"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(ask.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ask.command); expect(value).toEqual(before);
  });

  it("does not invent a whisper, current invitation answer or evidence before the saved action", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "withdrawn-invitation", attempt()), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "呓语者当前许可与残余" });
    for (const text of ["尚无实际低语来源", "尚无实际低语尝试", "当前轻微残余 0 秒", "尚未当面取得当前答复", "普通方法不虚构声音", "尚未实际完成普通核验"]) expect(current.textContent).toContain(text);
    expect(current.textContent).not.toContain("诺拉当面拒绝邀请"); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps a successful residual visible after STOP_VOICE until an actual WAIT_CLEAR is saved", () => {
    const stop = action({ type: "STOP_VOICE", caseId: "conflicting-bell" }, "停止这一次实际输入"), wait = action({ type: "WAIT_CLEAR", caseId: "conflicting-bell" }, "实际等待当前残余", "0行动 · 30秒");
    const current = attempt({ consent: "GRANTED", whisperTier: "SUCCESS", whisperSourceId: "BL3-NORA", whisperAtSecond: 18, voiceActive: true, residualSeconds: 30, spiritualitySpent: 4, mindSpent: 1, resolutionPaid: true, resolutionActions: 1 });
    const value = activate(projection({ promoted: true, actions: [stop], preferredActionId: stop.id }), "conflicting-bell", current), { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command);
    expect(screen.getByRole("region", { name: "呓语者当前许可与残余" }).textContent).toContain("尚未明确停止");
    const saved = structuredClone(value); saved.life.currentAttempt!.voiceActive = false; saved.life.currentAttempt!.stopped = true; saved.life.cases[0]!.attempts = [saved.life.currentAttempt!]; saved.actions = [wait]; saved.preferredActionId = wait.id;
    rerender(<BlathererPanel {...defaults} value={saved} />);
    const facts = screen.getByRole("region", { name: "呓语者当前许可与残余" });
    for (const text of ["输入：已实际停止", "当前轻微残余 30 秒", "已实际等候 0 秒", "原成功迟疑仍在", "已付灵性 4、精神 1"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledTimes(2); expect(onCommand).toHaveBeenLastCalledWith(wait.command); expect(saved.life.currentAttempt!.residualSeconds).toBe(30);
  });

  it("shows successful actual waiting without refunding spent resources or restoring consent", () => {
    const current = attempt({ consent: "REVOKED", whisperTier: "SUCCESS", whisperSourceId: "BL3-NORA", stopped: true, residualSeconds: 0, waitedSeconds: 30, waitCompleted: true, spiritualitySpent: 4, mindSpent: 1, resolutionActions: 1 });
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "withdrawn-invitation", current), before = structuredClone(value); panel(value);
    const facts = screen.getByRole("region", { name: "呓语者当前许可与残余" });
    for (const text of ["当前许可：已撤回同意", "当前轻微残余 0 秒", "已实际等候 30 秒", "实际等待已完成", "原费用和当事人的选择仍保留", "已付灵性 4、精神 1"]) expect(facts.textContent).toContain(text);
    expect(value).toEqual(before);
  });

  it("shows revocation after an actual attempt and exposes only the current permitted fallback", () => {
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "withdrawn-invitation" }, "普通核对现时答复", "补查0行动"), denied = action({ type: "WHISPER", caseId: "withdrawn-invitation" }, "再次尝试低语", "4灵性1精神", { enabled: false, reason: "诺拉已经撤回，不能沿用旧许可。" });
    const current = attempt({ consent: "REVOKED", whisperTier: "FAILURE", whisperSourceId: "BL3-NORA", stopped: true, waitCompleted: true, currentAnswer: "DECLINED", spiritualitySpent: 4, mindSpent: 1, resolutionActions: 1 });
    const value = activate(projection({ promoted: true, actions: [ordinary, denied], preferredActionId: ordinary.id }), "withdrawn-invitation", current), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "呓语者当前许可与残余" });
    for (const text of ["已撤回同意", "不能沿用此前同意", "失败成本保留", "诺拉当面拒绝邀请", "原卡整案仍属于她，由她本人持有"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it("shows a declined current volunteer without turning a previous willingness into control", () => {
    const current = attempt({ consent: "DECLINED" }), value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "conflicting-bell", current);
    value.life.volunteer.willing = false; panel(value);
    const facts = screen.getByRole("region", { name: "呓语者原人原物与真实位置" });
    expect(facts.textContent).toContain("她当前不愿参与，旧许可不能强迫继续"); expect(facts.textContent).toContain("当前许可：当前已拒绝");
  });

  it.each(["FAILURE", "GREAT_FAILURE"] as const)("retains the %s cost and distinguishes a real ordinary fallback from mastery", tier => {
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "conflicting-bell" }, "失败后实做普通核对", "补查0行动");
    const current = attempt({ whisperTier: tier, whisperSourceId: "BL3-NORA", stopped: true, waitCompleted: true, spiritualitySpent: 4, mindSpent: 1, resolutionActions: 1 });
    const value = activate(projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id }), "conflicting-bell", current), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "呓语者原人原物与真实位置" });
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(facts.textContent).toContain("失败已付成本不退，普通完成不加低语掌握");
    expect(facts.textContent).toContain("已付灵性 4、精神 1、实施行动 1");
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it("keeps the original bystander in range until his real route has been saved", () => {
    const ask = action({ type: "ASK_GUIDE_LEAVE", caseId: "open-corridor" }, "请罗安实际走出听距", "0行动 · 12米12秒");
    const voice = action({ type: "WHISPER", caseId: "open-corridor" }, "尝试本次有限低语", "4灵性1精神", { enabled: false, reason: "原导师仍在6米可听范围内；熟人不免疫，不扣费也不施术。" });
    const value = activate(projection({ promoted: true, actions: [voice, ask], preferredActionId: ask.id }), "open-corridor", attempt({ consent: "GRANTED", cardRead: true, bellRead: true }));
    value.life.guide.location = "B"; value.life.guide.travelMetres = 12;
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "呓语者原人原物与真实位置" });
    for (const text of ["当前在B", "熟人没有免疫", "B→START8米，再4米到室外", "尚无实际低语来源"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(ask.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ask.command); expect(value.life.guide.location).toBe("B"); expect(value).toEqual(before);
  });

  it("renders actual original-card carrying, return and zero-action cleanup without teleporting", () => {
    const give = action({ type: "RETURN_CARD", caseId: "conflicting-bell" }, "在A实际归还原卡", "0行动 · 1秒"), exit = action({ type: "RETURN_START", caseId: "conflicting-bell" }, "沿原4米路径退出", "0行动 · 4米4秒", { enabled: false, reason: "先在A归还同一原卡。" });
    const current = attempt({ method: "ORDINARY", ordinaryChecked: true, cardTaken: true, cardRead: true, bellRead: true, outcomeRecorded: true, result: "ORDINARY", playerTravelMetres: 12, elapsedSeconds: 18,
      playerMoves: [{ from: "A", to: "B", mode: "WALK", metres: 4, seconds: 4, itemIds: ["BL3-CARD"] }] });
    const value = activate(projection({ promoted: true, actions: [give, exit], preferredActionId: give.id }), "conflicting-bell", current);
    value.life.playerLocation = "A"; value.life.card.location = "PLAYER"; value.life.card.travelMetres = 8;
    const before = structuredClone(value), { onCommand, onClose } = panel(value), facts = screen.getByRole("region", { name: "呓语者原人原物与真实位置" });
    expect(facts.textContent).toContain("当前由玩家临时持有"); expect(facts.textContent).toContain("原卡实际携行 8 米");
    expect(screen.getByRole("region", { name: "呓语者停止与真实返程" }).textContent).toContain("先在A归还同一原卡");
    fireEvent.click(button(give.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(give.command); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("closes the view without stopping current input, clearing a residual or changing the original card", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "conflicting-bell", attempt({ voiceActive: true, residualSeconds: 30, whisperSourceId: "BL3-NORA", whisperTier: "SUCCESS" }));
    value.life.playerLocation = "A"; value.life.card.location = "PLAYER";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭呓语者页面"));
    expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("reports an ordinary completed scene using only REPORT_CASE without granting new mastery locally", () => {
    const report = action({ type: "REPORT_CASE", caseId: "conflicting-bell" }, "报告普通核验与真实退出", "1行动 · 扮演25"), value = projection({ promoted: true, actions: [report], preferredActionId: report.id });
    value.life.cases[0]!.status = "EXAMINED"; value.life.cases[0]!.returned = true; value.life.cases[0]!.closes = 1;
    value.life.cases[0]!.attempts = [attempt({ method: "ORDINARY", result: "ORDINARY", closed: true, ordinaryChecked: true, cardReturned: true, outcomeRecorded: true, outcome: "完全普通核验完成，未施术。" })];
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(report.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command); expect(value.abilities[0]!.mastery).toBe(0); expect(value).toEqual(before);
  });
});


describe("Blatherer exact authored paragraph display", () => {
  it("adapts authored source paragraphs without mutating fixture commands or costs", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    await open("能力范围与实际掌握");
    expect(screen.queryByText(BLATHERER_FORMULA_STATUS)).toBeNull();
    expect(screen.getByText("呓语者为深渊序列3；完整配方尚未掌握，服用前需要专业准备。主辅材料、用量、调配顺序和完整仪式均保持未知，仍须完成服药准备。本阶段只有独立成品渠道与专业支持，同一位原成年导师罗安·费里沿用原人。三项真实准备及当周安静原房检查不搭祭坛、不收血晶、不开放自制配方。")).toBeTruthy();
    expect(screen.queryByText(BLATHERER_SOURCE_STATUS)).toBeNull();
    expect(screen.getByText("呓语者序列3仅开放有限低语，不提供血晶或献祭祭坛。下一序列2鲜血大公尚未开放，不授天使腐化、免费召唤、全域疯狂、远程声音或灵魂所有权。本阶段唯一新能力abyss.s3.limited-murmur“有限低语”及独立成年诺拉·温特46岁BL3-NORA、埃德里克·凯尔48岁BL3-EDRIC、三项原场、原物、同意安排、6米听距、2秒输入、30秒残留、4灵性1精神与知识18检定、战斗本轮下一正贡献身体或弧光攻击减半一次等全部新场景和数值均以当前说明为准。旧罪犯至魔鬼的全部人物、原物、种子、原敌结果和道德及紧绷代价保留；普通和平扮演100仅是有成本替代，不保证安全消化，不恢复原有良知。")).toBeTruthy();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
