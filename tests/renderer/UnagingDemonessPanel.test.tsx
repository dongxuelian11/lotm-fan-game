/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnagingDemonessPanel, type UnagingDemonessPanelProps } from "../../src/renderer/UnagingDemonessPanel";
import type { UnagingDemonessAction, UnagingDemonessCommand, UnagingDemonessProjection } from "../../src/domain/unaging-demoness/types";
import { UNAGING_DEMONESS_ABILITIES, UNAGING_DEMONESS_CONSUMPTION_RISK, UNAGING_DEMONESS_FORMULA_STATUS, UNAGING_DEMONESS_SOURCE_STATUS } from "../../src/domain/unaging-demoness/content";
import { createUnagingDemonessLifeState, validateUnagingDemonessActivityCommand } from "../../src/domain/unaging-demoness/life";
import { validateUnagingDemonessAcquisitionCommand } from "../../src/domain/unaging-demoness/index";

type Attempt = NonNullable<UnagingDemonessProjection["life"]["currentAttempt"]>;
type CaseId = UnagingDemonessProjection["life"]["cases"][number]["id"];
const date = { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 } as const;
const action = (command: UnagingDemonessCommand, label: string, cost = "0行动", extra: Partial<UnagingDemonessAction> = {}): UnagingDemonessAction =>
  ({ id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra });
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取不老魔女专业指导", "1行动 · 500便士");
const consume = (id = "unaging-demoness-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Isolated public projection fixtures for component behavior only. These are not campaign,
// promotion, mirror-success or natural-random-run evidence. Commands retain the real domain API.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 114, date, method: "ABILITY", closed: false, result: "NONE", initialSpirituality: 48, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0,
    ownerConsent: "UNASKED", observerConsent: "UNASKED", stopped: false, inspected: false, itemTaken: false, itemReturned: false,
    oldRead: false, currentHeard: false, recordWritten: false, mirrorsChecked: false, entryTier: null, exitTier: null,
    entered: false, innerBVisited: false, exitedB: false, returnedViaEntry: false, delivered: false, handovers: 0, parcelRetrievals: 0,
    shutterClosed: false, blockedObserved: false, shutterOpened: false, ...extra };
}
function life(): UnagingDemonessProjection["life"] {
  return { ...createUnagingDemonessLifeState(), title: "三项有限原镜实践G", story: "原人、原物和本体实际走动。", environment: "唯一已知原镜路线。", nextStep: "先取得本案原主同意。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["UD3-GALLERY本人在START，实际0米、0秒。", "维瑞娜·肖UD3-VERA，46岁，在START；马库斯·赫尔UD3-MARCUS，41岁，在B。", "本案许可尚未取得；原普通出口实际开放。"],
    cases: ([
      { id: "dated-record", title: "旧素描与当下登记", story: "同一UD3-PORTRAIT与UD3-REGISTER；先读旧日期与人名，当面听说明，再本人走4米到原桌写记录并回4米归画。" },
      { id: "mirror-parcel", title: "同一本体与同一原封包", story: "同一800克UD3-PARCEL；两次独立6灵性检定、镜内6米，失败留在真实位置，普通外路18米。" },
      { id: "blocked-exit", title: "B端原封板与真实回撤", story: "UD3-SHUTTER一份原测试资源；原路6米返身后须本人普通18米到B请求原观察员开板。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): UnagingDemonessProjection["encounter"] {
  return { title: "科宾的原院冲突G", story: "原科宾用自己的原棍与独立灵性，两面原镜可以实际破损。", status: "AVAILABLE", inside: false, scene: null, enemy: null, actions: [],
    facts: ["UD3-COMBAT-A与UD3-COMBAT-B为两面原镜；镜间2米。普通出口从A2米、从B4米，无第三人。"] };
}
function projection(extra: Partial<UnagingDemonessProjection> = {}): UnagingDemonessProjection {
  return { title: "不老魔女·魔女序列3", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "原镜有限路线G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `unaging-demoness-potion-${n}`, title: `不老魔女第${n}独立原瓶`, source: `UD3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `unaging-demoness-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对原身份记录", completedWeek: 110 }, { taskId: "TRACE_MIRRORS", title: "核验原镜路线", completedWeek: 111 }, { taskId: "MARK_RETURN", title: "标明实际返回顺序", completedWeek: 112 }],
    preparedWeek: null, abilities: UNAGING_DEMONESS_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原绝望魔女消化100，晋升后已满12整周。", pollution: 3,
    risk: UNAGING_DEMONESS_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    currentGender: "FEMALE", appearanceRecord: "第113周登记年轻外观；原创建年龄26岁保留，创建年龄不是当前年龄，不重置为18岁。",
    inheritedHistory: ["诺斯原身体与刺客至绝望魔女六阶段全部原物保留。", "原瓦伦DP4-VALEN-HOLT仍投降，H60/M100/S12，实际照护60便士后病势0，原病史终值2不改写，原重轻伤继续保留。", "旧镜、粉剂与旧掌握0不补回。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "UD3-GALLERY的原镜A/B仅有一条已知6米内路及18米外路。", ...extra };
}
function activate(value: UnagingDemonessProjection, id: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<UnagingDemonessPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<UnagingDemonessPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择不老魔女事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("UnagingDemonessPanel isolated public projections and exact saved commands", () => {
  it("leads with one objective selector, current resources and a disabled next-step reason", () => {
    const reason = "原绝望魔女只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title })); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "不老魔女当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "不老魔女当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取不老魔女专业指导").disabled).toBe(true); expect(button("听取不老魔女专业指导").getAttribute("aria-describedby")).toContain("unaging-demoness-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原身体、年轻外观与旧魔女路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取不老魔女专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected preparation objective ahead of optional bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_RETURN" }, "写下本人实际返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "unaging-demoness-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "不老魔女下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects another independent bottle locally and submits its actual labour command only once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "unaging-demoness-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "unaging-demoness-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:unaging-demoness-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button("第二原瓶实际劳务")); fireEvent.click(button("第二原瓶实际劳务"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(validateUnagingDemonessAcquisitionCommand(second.command)).toBe(true); expect(value).toEqual(before);
  });

  it("reviews the selected original, 140-cost preparation, four outcomes and unchanged body before submission", async () => {
    const first = consume(), second = consume("unaging-demoness-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 113, insideCase: true });
    const { onCommand, onClose } = panel(value); expect(picker().disabled).toBe(false);
    await userEvent.selectOptions(picker(), "bottle:unaging-demoness-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "不老魔女原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "不老魔女第2独立原瓶" }));
    for (const text of ["unaging-demoness-potion-2", "UD3-SEAL-2", "73%", "第113周", "140便士不退", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "原创建年龄", "当前灵性不补满", "不把年龄重置为18", "性别", "女性"]) expect(review.textContent).toContain(text);
    expect(within(review).queryByText(UNAGING_DEMONESS_FORMULA_STATUS)).toBeNull();
    expect(review.textContent).toContain("完整配方尚未掌握，服用前需要专业准备"); expect(review.textContent).not.toContain("UD3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "不老魔女原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("retains the exact confirmed intent through a failed save without charging or submitting twice", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<UnagingDemonessPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "不老魔女原瓶服用确认" })).toBeTruthy();
    rerender(<UnagingDemonessPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.insideCase = false; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<UnagingDemonessPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "不老魔女原瓶服用确认" })).toBeNull();
    expect(button("关闭不老魔女页面").disabled).toBe(false); expect(picker().value).toBe("case:dated-record"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks every new command, selection and local close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取不老魔女专业指导")); fireEvent.click(button("关闭不老魔女页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取不老魔女专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates unsubmitted review after saved resources or original eligibility change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<UnagingDemonessPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "不老魔女原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("pins the actual original case and puts the next action before the people, consents and positions", () => {
    const command: UnagingDemonessCommand = { type: "CONSENT_OWNER", caseId: "mirror-parcel" }, entry = action(command, "当面询问维瑞娜本案许可"), value = activate(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }), "mirror-parcel");
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "不老魔女原人原物与真实位置" });
    expect(picker().value).toBe("case:mirror-parcel"); expect(picker().disabled).toBe(true); expect(screen.getByRole("region", { name: "不老魔女当前行动" }).compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const text of ["UD3-GALLERY", "UD3-VERA", "46岁", "UD3-MARCUS", "41岁", "许可尚未取得", "原普通出口实际开放"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(validateUnagingDemonessActivityCommand(command)).toBe(true); expect(value).toEqual(before);
  });

  it("keeps the dated-original record ordinary and never awards it mirror mastery", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "dated-record", method: "ORDINARY" }, "准备普通原日期核查", "1行动"), value = projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id });
    value.life.cases[0]!.status = "OBSERVED"; value.life.facts = ["原UD3-PORTRAIT日期1330年5月14日和人名维瑞娜·肖已核读。", "原UD3-REGISTER仍在A；旧日期与当面说明分别记录，不把年轻容貌写成过去被改变或永远安全。"];
    value.life.register.oldNameRead = "维瑞娜·肖"; value.life.register.oldDateRead = { epoch: "FIFTH_EPOCH", year: 1330, month: 5, day: 14 }; value.life.register.currentStatement = "这是我当年的画像；外貌不能证明出生记录改变。";
    const { onCommand } = panel(value); expect(screen.getByRole("region", { name: "不老魔女原日期登记" }).textContent).toContain("1330年5月14日"); expect(screen.getByRole("region", { name: "不老魔女原日期登记" }).textContent).toContain("本次原登记日期：尚未写入"); expect(screen.getByRole("region", { name: "当前不老魔女生活情境" }).textContent).toContain("共13行动");
    expect(screen.queryByRole("button", { name: /能力|开镜/ })).toBeNull(); expect(validateUnagingDemonessActivityCommand({ type: "PREPARE", caseId: "dated-record", method: "ABILITY" })).toBe(false);
    await open("能力范围与实际掌握"); expect(screen.getByRole("region", { name: "不老魔女能力与使用范围" }).textContent).toContain("掌握 0");
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("switches an unstarted case locally without submitting or changing another original", async () => {
    const first = action({ type: "OBSERVE", caseId: "dated-record" }, "观察旧素描"), second = action({ type: "OBSERVE", caseId: "blocked-exit" }, "观察B端原封板");
    const value = projection({ promoted: true, actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "case:blocked-exit"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察旧素描/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前不老魔女生活情境" }).textContent).toContain("一份原测试资源"); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(value).toEqual(before);
  });

  it("shows a paid failed entrance and ordinary completion without pretending the body entered", async () => {
    const close = action({ type: "CLOSE", caseId: "mirror-parcel" }, "关闭已收束原现场"), current = attempt({ entryTier: "FAILURE", result: "ORDINARY", spiritualitySpent: 6, elapsedSeconds: 44, playerTravelMetres: 44, delivered: true, itemReturned: true,
      playerMoves: [{ from: "A", to: "B", mode: "WALK", metres: 18, seconds: 18, itemIds: ["UD3-PARCEL"] }, { from: "B", to: "A", mode: "WALK", metres: 18, seconds: 18, itemIds: ["UD3-RECEIPT"] }] });
    const value = activate(projection({ promoted: true, actions: [close], preferredActionId: close.id }), "mirror-parcel", current);
    value.life.facts = ["A端进入失败时本人留A，已付6灵性不退。", "本人已沿外部普通路送交同一UD3-PARCEL并携原UD3-RECEIPT回START归还；原入口未形成。"];
    const before = structuredClone(value); panel(value); expect(fold("本次实际尝试与已付代价").open).toBe(true); const facts = screen.getByRole("region", { name: "不老魔女原人原物与真实位置" });
    for (const text of ["失败", "普通方法完成", "44 秒", "44 米", "已付灵性 6", "不能重骰", "本人留A", "UD3-PARCEL", "UD3-RECEIPT"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("实际镜路通行后完成"); await open("能力范围与实际掌握"); expect(screen.getByRole("region", { name: "不老魔女能力与使用范围" }).textContent).toContain("掌握 0"); expect(value).toEqual(before);
  });

  it("keeps failed B exit, same-body movements, original parcel and a real six-metre return separate", () => {
    const back = action({ type: "RETURN_INNER_A", caseId: "mirror-parcel" }, "本人沿原镜内6米回INNER_A", "0行动 · 实走6米"), close = action({ type: "CLOSE", caseId: "mirror-parcel" }, "收束原镜案", "0行动", { enabled: false, reason: "本人仍在INNER_B；必须先实际返身。" });
    const value = activate(projection({ promoted: true, actions: [back, close], preferredActionId: back.id }), "mirror-parcel", attempt({ entryTier: "SUCCESS", exitTier: "FAILURE", entered: true, innerBVisited: true, spiritualitySpent: 12, playerTravelMetres: 11, elapsedSeconds: 11, ownerConsent: "GRANTED", observerConsent: "GRANTED",
      playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: ["UD3-PARCEL"] }, { from: "A", to: "INNER_A", mode: "MIRROR_STEP", metres: 1, seconds: 1, itemIds: ["UD3-PARCEL"] }, { from: "INNER_A", to: "INNER_B", mode: "WALK", metres: 6, seconds: 6, itemIds: ["UD3-PARCEL"] }] }));
    value.life.playerLocation = "INNER_B"; value.life.facts = ["同一本体在INNER_B，同一原UD3-PARCEL由本人持有，未交给B原接收人。", "B端退出失败，原A入口仍为本次返身保持1次；先实际走回INNER_A，再实际跨出原A入口，不能远程送回START。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "不老魔女原人原物与真实位置" });
    for (const text of ["本次进入判定：成功", "本次B端退出判定：失败", "已付灵性 12", "同一本体跨原镜槛 1 米", "携行原物 UD3-PARCEL", "本案已同意", "保持1次", "不会自动补灵"]) expect(facts.textContent).toContain(text);
    expect(button(close.label).disabled).toBe(true); expect(button(close.label).closest("details")).toBeNull(); fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
  });

  it("shows the actually blocked B shutter and real return without allowing CLOSE to open it", () => {
    const back = action({ type: "RETURN_ENTRY", caseId: "blocked-exit" }, "同一本体跨原A镜槛返身", "0行动 · 实际1米"), close = action({ type: "CLOSE", caseId: "blocked-exit" }, "结束封板试验", "0行动", { enabled: false, reason: "B原封板仍关闭，须普通到B当面请原观察员开启。" });
    const value = activate(projection({ promoted: true, actions: [back, close], preferredActionId: back.id }), "blocked-exit", attempt({ entryTier: "SUCCESS", entered: true, shutterClosed: true, blockedObserved: true, spiritualitySpent: 6 }));
    value.life.playerLocation = "INNER_A"; value.life.shutter.state = "CLOSED"; value.life.shutter.remainingTests = 0; value.life.entry.held = true; value.life.entry.returnStepsRemaining = 1;
    value.life.facts = ["本人已由INNER_B沿原6米回INNER_A，尚未跨出。", "UD3-SHUTTER仍实际关闭；原测试资源0，不能强行从B退出。", "原A入口保持本次1次返身，之后须普通18米走到B，由UD3-MARCUS实际开板；原门不因CLOSE复原。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "不老魔女原人原物与真实位置" });
    for (const text of ["尚未跨出", "UD3-SHUTTER", "原测试资源0", "不能强行从B退出", "普通18米", "不因CLOSE复原"]) expect(facts.textContent).toContain(text);
    expect(button(close.label).disabled).toBe(true); fireEvent.click(button(close.label)); expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(validateUnagingDemonessActivityCommand(back.command)).toBe(true); expect(value).toEqual(before);
  });

  it("keeps ordinary stopping and local view closing from moving any body or restoring a shutter", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "blocked-exit"); value.life.playerLocation = "INNER_B"; value.life.shutter.state = "CLOSED";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭不老魔女页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("shows the original combat enemy's independent resources, actual broken mirror and ordinary fallback", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "本人普通4米离开原院", "0行动 · 实走4米"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id });
    value.encounter.inside = true; value.encounter.status = "READY";
    value.encounter.scene = { courtId: "UD3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "B", mirrorA: { id: "UD3-COMBAT-A", intact: true }, mirrorB: { id: "UD3-COMBAT-B", intact: false }, mirrorsDistanceMetres: 2, exits: { A: 2, B: 4 }, ordinaryWalkedMetres: 0, mirrorPassedMetres: 2 };
    value.encounter.enemy = { id: "UD3-CORBIN", name: "科宾·里德", age: 49, source: "ORIGINAL_LIMITED_G", sequence: 3, health: 60, mind: 84, spirituality: 7, status: "RESISTING", weaponId: "UD3-CORBIN-ROD", weaponLocation: "HAND", powerUses: { FORCE_STRIKE: 2, SEAL_MIRROR: 3, BREAK_MIRROR: 1 } };
    value.encounter.facts = ["原UD3-COMBAT-A完好，原UD3-COMBAT-B已破损，破镜已实耗5灵性且不能再打已碎镜。", "本人在B；原普通出口实际开放，须本人走4米。封镜4灵性仅有限下一次，原三次已耗尽；无资源时原棍普通回退。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "不老魔女原人遭遇" });
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    const route = screen.getByRole("region", { name: "不老魔女原战斗镜与真实退路" }); for (const text of ["UD3-COURT", "本人实际在B", "UD3-COMBAT-B：原镜已破损", "原普通出口实际开放", "B至出口 4 米"]) expect(route.textContent).toContain(text);
    for (const text of ["科宾·里德", "49岁", "UD3-CORBIN", "健康 60", "精神 84", "7 / 120", "UD3-CORBIN-ROD", "UD3-COMBAT-B已破损", "4灵性", "普通回退", "跨战保留"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });

  it("preserves young-appearance registration and old Valen's distinct current care and past disease facts read-only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原身体、年轻外观与旧魔女路线记录"); const history = screen.getByRole("region", { name: "不老魔女继承记录" });
    for (const text of ["女性", "第113周", "原创建年龄26岁", "不是当前年龄", "不重置为18岁", "DP4-VALEN-HOLT", "60便士后病势0", "原病史终值2", "原重轻伤", "旧掌握0仍为0"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps the unknown recipe and resurrection limits apart from the one implemented ability", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("独立成品与晋升准备"); const formula = screen.getByRole("region", { name: "不老魔女成品与配方边界" });
    for (const text of ["完整配方", "完整仪式均保持未知", "尚未掌握", "不老泉", "不列作已知材料", "UD3-MIREL", "54岁", "6400", "900便士", "140便士", "12整周"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "不老魔女能力与使用范围" });
    for (const text of ["镜内可能存在陷阱", "本体也可能被高阶力量强行拉出", "不保证逃脱", "不保证永生", "全球", "自动复活", "六十年", "掌握 0", "知识18", "同一身体", "不同时攻击"]) expect(scope.textContent).toContain(text);
    expect(UNAGING_DEMONESS_ABILITIES).toHaveLength(1); expect(UNAGING_DEMONESS_ABILITIES[0]!.id).toBe("assassin.s3.mirror-passage");
  });
  it("adapts the authored formula and source paragraphs without mutating the projection", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "不老魔女成品与配方边界" });
    expect(within(formula).getByText("不老魔女为魔女途径序列3，完整配方尚未掌握，服用前需要专业准备。材料、用量、调配顺序和完整仪式均保持未知，仍须完成服药准备。不老泉只是未证实的条件假设，不列作已知材料。本阶段仅有明确独立成品渠道与专业支持；三项准备、当周场地检查和自我记录不开放自制配方。")).toBeTruthy();
    expect(within(formula).queryByText(UNAGING_DEMONESS_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "不老魔女能力与使用范围" });
    expect(within(scope).getByText("不老魔女3具有长寿、年轻容貌与镜界通行能力，但具体寿命未给出统一数值，也不保证永生。镜内可能存在陷阱，本体也可能被高阶力量强行拉出；镜界通行不保证逃脱，不赋予高阶截留免疫、真空免疫、任意全球传送或自动复活。本阶段没有可用的死后镜替复活流程，也不套用不死者的六十年规则；不开放下一序列能力。当前只使用两面原镜与唯一六米镜内道路，原小封包以一千克为上限；每次开口消耗六灵性并作知识18检定，返回须满足受控原入口的返身窗口。成年人各自真实同意和退出，原身体、原物、原日期与既往记录保持真实。")).toBeTruthy();
    expect(within(scope).queryByText(UNAGING_DEMONESS_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before);
  });

});

describe("UnagingDemonessPanel exact progression scope", () => {
  it("states S3 mirror and lifespan limits while keeping discovered Calamity preparation separate", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    const goal = screen.getByRole("region", { name: "不老魔女当前目标" });
    expect(within(goal).getByText("不老魔女为魔女途径序列3，具有长寿、年轻外观与有限镜界通行能力，不保证永生、逃脱或自动复活；本场原镜、人物、有限路线与数值以当前说明为准。完整配方与晋升仪式细节尚未掌握。本页不直接授予序列2及以上能力；发现灾难魔女渠道后，可查看独立晋升准备，仍须满足其实际条件。", { exact: true })).toBeTruthy();
    expect(within(goal).queryByText("已核长寿年轻外观与镜界道路方向；本场原镜、人物、有限路线与数值均为原创G。完整配方与原著晋升仪式未知，序列2及以上尚未开放。", { exact: true })).toBeNull();
    expect(goal.textContent).not.toContain("序列2及以上尚未开放");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
