/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DreamWeaverPanel, type DreamWeaverPanelProps } from "../../src/renderer/DreamWeaverPanel";
import type { DreamWeaverAction, DreamWeaverCommand, DreamWeaverProjection } from "../../src/domain/dream-weaver/types";
import { DREAM_WEAVER_CONSUMPTION_RISK } from "../../src/domain/dream-weaver/content";

function action<T extends DreamWeaverCommand>(command: T, label: string, cost = "0行动", extra: Partial<Omit<DreamWeaverAction, "command">> = {}): Omit<DreamWeaverAction, "command"> & { command: T } {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取织梦人专业指导", "1行动 · 500便士");
const consume = (bottleId = "dream-weaver-potion-1") => action({ type: "CONSUME", bottleId, confirmed: true }, `核对并服用${bottleId}`, "0行动 · 消耗这一原瓶");

/** Public renderer fixture only; this is not a natural playthrough or evidence of domain eligibility. */
function projection(extra: Partial<DreamWeaverProjection> = {}): DreamWeaverProjection {
  return {
    title: "织梦人3 · 有限身份与梦像", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "本场具体范围、时间与代价为G，外部身份与本人共通实际取得的知识。",
    supplies: "独立序列3成品三瓶；每瓶6200便士，五次实际劳务后800便士。补货须真实下一周。",
    actions: [guidance()], bottles: [1, 2, 3].map(number => ({ id: `dream-weaver-potion-${number}`, title: `织梦人第${number}独立原瓶`,
      source: `独立序列3批次第${number}瓶，原封签DWV3-SEAL-${number}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `dream-weaver-potion-${number}`, confirmed: true as const } })),
    preparations: [
      { taskId: "INSPECT_ROUTE", title: "亲自踏查原普通路线", completedWeek: 83 },
      { taskId: "CHECK_ORIGINALS", title: "实际核对原物与本人", completedWeek: 84 },
      { taskId: "PLAN_WITHDRAWAL", title: "实际演练停止与返回", completedWeek: 84 },
    ],
    preparedWeek: 86,
    abilities: [
      { id: "audience.s3.external-identity", label: "有限外部身份", mastery: 0, description: "最多一具，60秒与6米G，共通已取得的心思。" },
      { id: "audience.s3.woven-image", label: "有限织梦形象", mastery: 8, description: "相信产生有限精神后果，识破与抵抗可以制约。" },
    ],
    acting: 0, digestion: "操纵师消化100；从原晋升第74周起，已经过12/12真实整周。", pollution: 3, risk: DREAM_WEAVER_CONSUMPTION_RISK,
    resources: { health: 83, maxHealth: 100, mind: 77, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE",
    inheritedHistory: ["原操纵师消化100；观众9至操纵师4原ID与掌握保留。", "原五场万人聚会均已散场，七滴泪只各用一次，MP4-P1已归并。", "旧鲁兰H100/M0已投降；三次真实专业稳定后病势0，原MP4-RULAN-CLUB仍留YARD。"],
    life: life(), encounter: encounter(), insideCase: false,
    environment: "DWV3-READING-ROOM原近桌与远桌相隔3米，普通路开放，留言与铜铃各只有一个。",
    ...extra,
  };
}

function attempt(extra: Partial<NonNullable<DreamWeaverProjection["life"]["currentAttempt"]>> = {}): NonNullable<DreamWeaverProjection["life"]["currentAttempt"]> {
  return {
    week: 87, method: "ABILITY", consentWeeks: { "DWV3-IRIS": 87, "DWV3-OWEN": 87 }, revokedPersonIds: [],
    performed: true, closed: false, result: "NONE", elapsedSeconds: 0, ownerTravelMetres: 0, identityTravelMetres: 0,
    identityAttempted: false, identityCreated: false, identityId: null, identityCreatedAtSeconds: null, identityEnd: "NONE", identityLastNode: "NEAR",
    spiritualitySpent: 0, ownerMindSpent: 0, talkedToOwen: false, irisTalkBy: "NONE", messageReadBy: "NONE",
    messageTaken: false, messageChecked: false, messageReturned: false, imageAttempted: false, imageCreated: false,
    imageBelieved: false, imageRecognized: false, imageStopped: false, owenMindSpent: 0, bellChecked: false,
    ...extra,
  };
}

function life(): DreamWeaverProjection["life"] {
  return {
    title: "同一自我与有限形象", source: "本场原创G", environment: "每案报告25，反思25；只给实际成功对应能力掌握。",
    insideCase: false, reflected: false, currentAttempt: null,
    currentConsents: [{ id: "DWV3-IRIS", consented: false }, { id: "DWV3-OWEN", consented: false }],
    practice: {
      sceneId: "DWV3-READING-ROOM", activeCase: null, ownerNode: "NEAR",
      participants: {
        "DWV3-IRIS": { id: "DWV3-IRIS", name: "艾丽丝", age: 36, node: "FAR", health: 100, mind: 100 },
        "DWV3-OWEN": { id: "DWV3-OWEN", name: "欧文", age: 44, node: "NEAR", health: 100, mind: 98 },
      },
      identity: null, image: null, message: { id: "DWV3-MESSAGE", ownerId: "DWV3-IRIS", holder: "FAR_DESK" }, knownMessage: null,
      bell: { id: "DWV3-BELL", holder: "NEAR_DESK", marking: "ONE_BRASS_BELL_TWO_RINGS" },
    },
    cases: ([
      { id: "two-desks", title: "相邻两桌", story: "本人与欧文在近桌、单身份与艾丽丝在远桌；普通本人依次交谈。" },
      { id: "original-message", title: "同一原留言", story: "先实际读取，再由本人普通取还同一张纸，外部身份不能搬物。" },
      { id: "woven-bell", title: "可停止的原铃梦像", story: "欧文知情演示，艾丽丝旁观；普通方法核对唯一原铃。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
      contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}

function activate(value: DreamWeaverProjection, caseId: DreamWeaverProjection["life"]["cases"][number]["id"], current = attempt()) {
  value.insideCase = true; value.life.insideCase = true; value.life.practice!.activeCase = caseId;
  value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.attempts = [current];
  return value;
}

function encounter(): DreamWeaverProjection["encounter"] {
  return {
    title: "原奥斯蒙德的独立通行争议", story: "两具原身体相距2米；普通出口开放，无追逐、无旁人。", status: "AVAILABLE", inside: false,
    enemy: { id: "DWV3-OSMOND", name: "奥斯蒙德", age: 45, sequence: 3, health: 91, mind: 88, spirituality: 103,
      status: "RESISTING", weaponId: "DWV3-OSMOND-CLUB", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 3, COMPOSE: 2 } },
    mentalPlague: 0, helpHistory: [], actions: [],
    facts: ["本次有限G3等效，不冒称已核原著途径3。", "梦像可识破与抵抗，不能真召神灵或无条件控制。", "原伤势保留，离场不会恢复健康、精神或灵性。"],
  };
}

function panel(value = projection(), props: Partial<Omit<DreamWeaverPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<DreamWeaverPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
async function open(text: string) { await userEvent.click(screen.getByText(text, { selector: "summary" })); }
afterEach(cleanup);

describe("DreamWeaverPanel committed identity, knowledge, originals and consent", () => {
  it("leads with the actual promotion gate and never displays invented recipe ingredients", () => {
    const reason = "从实际晋4第74周起尚只有11/12整周，须真实下一周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应显示的假材料", quantity: 8, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "织梦人当前目标" }).textContent).toContain(reason);
    expect(button("听取织梦人专业指导").disabled).toBe(true);
    expect(button("听取织梦人专业指导").getAttribute("aria-describedby")).toContain("dream-weaver-reason-");
    fireEvent.click(button("听取织梦人专业指导")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByText("不应显示的假材料")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps unknown recipe and old history in closed native details, with initial keyboard focus", async () => {
    const { onCommand } = panel();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "织梦人3 · 有限身份与梦像" }));
    for (const label of ["独立成品、专业准备与配方边界", "原身体、旧人格与继承记录", "原场地与普通生活"]) expect(fold(label).open).toBe(false);
    await open("独立成品、专业准备与配方边界"); expect(fold("独立成品、专业准备与配方边界").open).toBe(true);
    const boundary = screen.getByRole("region", { name: "织梦人成品与配方边界" });
    for (const text of ["完整配方", "仍未知", "本作G", "万人共鸣窗口", "6200", "800", "第83周"]) expect(boundary.textContent).toContain(text);
    expect(within(boundary).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("submits once, ignores an identical cloned projection, and unlocks only on changed saved facts", () => {
    const value = projection(), before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button("听取织梦人专业指导")); fireEvent.click(button("听取织梦人专业指导"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
    expect(screen.getByRole("status").textContent).toContain("正在结算并保存");
    rerender(<DreamWeaverPanel {...defaults} value={structuredClone(value)} />);
    fireEvent.click(button("听取织梦人专业指导")); expect(onCommand).toHaveBeenCalledOnce();
    const nextCommand: DreamWeaverCommand = { type: "PREPARE_TASK", taskId: "INSPECT_ROUTE" };
    rerender(<DreamWeaverPanel {...defaults} value={{ ...value, actions: [action(nextCommand, "实际踏查原路", "1行动")] }} />);
    fireEvent.click(button("实际踏查原路")); expect(onCommand).toHaveBeenNthCalledWith(2, nextCommand);
  });

  it.each(["busy", "blocked"] as const)("locks mutations, selection and page dismissal while %s", flag => {
    const { onCommand, onClose } = panel(projection(), { [flag]: true });
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) { expect(control.disabled).toBe(true); fireEvent.click(control); }
    expect((screen.getByRole("combobox", { name: "选择独立织梦人原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("shows actual resources before any collapsed history and never fills spirituality to its cap", () => {
    panel(); const resources = screen.getByRole("region", { name: "织梦人当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["83 / 100", "77 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(resources.textContent).not.toContain("120 / 120");
  });

  it("selects one original bottle and sends only that bottle's actual labour command", async () => {
    const commands: DreamWeaverCommand[] = [{ type: "POTION_WORK", bottleId: "dream-weaver-potion-1" }, { type: "POTION_WORK", bottleId: "dream-weaver-potion-2" }];
    const value = projection({ actions: commands.map((command, index) => action(command, `第${index + 1}瓶实际劳动`, "1行动 · 本瓶劳务")) }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立织梦人原瓶" }), "dream-weaver-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶实际劳动/ })).toBeNull(); fireEvent.click(button("第2瓶实际劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it("reviews one original bottle, real risk and unchanged sex, and restores focus on cancellation", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "织梦人原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "织梦人第1独立原瓶" }));
    for (const text of ["dream-weaver-potion-1", "DWV3-SEAL-1", "71%", "第86周", "本渠道仅提供独立成品", "晋升仍须完成专业准备", "女性", "身体性别不改变", "当前灵性不补满", "成功或失败", "普通死亡"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("DWV3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button("暂不服用")); expect(document.activeElement).toBe(button("核对并服用"));
  });

  it("Escape cancels only the unsubmitted review and never leaves the real preparation", async () => {
    const value = projection({ actions: [consume()] }), before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "织梦人原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("forwards the exact reviewed consume intent once and prevents Escape during its save", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const confirm = button("确认服用这一原瓶"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "dream-weaver-potion-1", confirmed: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(confirm.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "织梦人原瓶服用确认" })).toBeTruthy();
  });

  it("invalidates unsubmitted review if saved cost, resources or original bottle facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    const changes: DreamWeaverProjection[] = [
      { ...value, actions: [{ ...consume(), cost: "新增实际成本" }] },
      { ...value, resources: { ...value.resources!, spirituality: 41 } },
      { ...value, bottles: value.bottles.map(bottle => ({ ...bottle, status: "原瓶已耗尽" })) },
    ];
    for (const changed of changes) {
      rerender(<DreamWeaverPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<DreamWeaverPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "织梦人原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative reason", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<DreamWeaverPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原场尚有未归还原物。" }] }} />);
    const confirm = button("确认服用这一原瓶"); expect(confirm.disabled).toBe(true); expect(confirm.getAttribute("aria-describedby")).toBe("dream-weaver-confirm-reason");
    expect(screen.getByRole("region", { name: "织梦人原瓶服用确认" }).textContent).toContain("未归还原物"); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it("holds the submitted original through save failure and directs retries to the outer control", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    rerender(<DreamWeaverPanel {...defaults} error={{ message: "原服药保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("上次已保存的记录"); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DreamWeaverPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
  });

  it("directs a nonretryable error to reload without sending a replacement or closing the page", () => {
    const { onCommand, onClose } = panel(projection(), { error: { message: "版本冲突", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(button("听取织梦人专业指导")); fireEvent.click(button("关闭织梦人页面")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the two adults' details folded and does not inherit old consent or restore Owen's mind", async () => {
    const value = projection({ promoted: true, actions: [] });
    value.life.currentConsents[0]!.consented = true;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("两位成年人的本次同意与状态").open).toBe(false);
    expect(screen.getByRole("region", { name: "织梦人当前原场" }).textContent).toContain("艾丽丝已同意此案；欧文当前未同意此案");
    await open("两位成年人的本次同意与状态"); const people = screen.getByRole("region", { name: "织梦人本次成年参与者" });
    for (const text of ["36岁", "44岁", "DWV3-IRIS", "DWV3-OWEN", "精神 98 / 100", "当前未同意", "旧米拉", "任何人均可停止"]) expect(people.textContent).toContain(text);
    expect(within(people).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("separates the owner's location, finite identity, shared knowledge and unmoved original paper", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "original-message", attempt({ elapsedSeconds: 8, identityAttempted: true, identityCreated: true, identityId: "DWV3-IDENTITY-original-message-1", identityCreatedAtSeconds: 2, identityTravelMetres: 3, spiritualitySpent: 5, ownerMindSpent: 2, messageReadBy: "IDENTITY" }));
    value.life.practice!.identity = { id: "DWV3-IDENTITY-original-message-1", originalName: "莉亚", source: "OWNER_SHARED_THOUGHT", node: "FAR", remainingSeconds: 54, limitMetres: 6 };
    value.life.practice!.knownMessage = { sourceId: "DWV3-MESSAGE", text: "测试已读事实：今晚本人合上西窗。", readWeek: 87, reader: "IDENTITY" };
    const before = structuredClone(value), { onCommand } = panel(value);
    const scene = screen.getByRole("region", { name: "织梦人当前原场" }); expect(scene.textContent).toContain("本人在原近桌");
    const identity = screen.getByRole("region", { name: "单一外部身份当前状态" });
    for (const text of ["原姓名 莉亚", "在原远桌", "剩余 54 秒", "有限范围 6 米", "思想、心思共通", "不能搬运原纸"]) expect(identity.textContent).toContain(text);
    const original = screen.getByRole("region", { name: "原留言实体" }), known = screen.getByRole("region", { name: "实际读取的已知内容" });
    expect(original.textContent).toContain("DWV3-MESSAGE"); expect(original.textContent).toContain("仍在原远桌"); expect(original.textContent).not.toContain("测试已读事实");
    expect(known.textContent).toContain("测试已读事实"); expect(known.textContent).toContain("第87周由远桌身份实际读取后共通给本人");
    expect(known.textContent).toContain("已读不等于原纸已送到"); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps unread contents unknown and safely hides stage-inaccessible practice", () => {
    const value = projection({ promoted: true, actions: [] }), { defaults, rerender } = panel(value);
    const known = screen.getByRole("region", { name: "实际读取的已知内容" });
    expect(known.textContent).toContain("尚未实际读取，留言内容未知"); expect(known.textContent).not.toContain("今晚");
    rerender(<DreamWeaverPanel {...defaults} value={{ ...value, promoted: false, life: { ...value.life, practice: null, cases: [], currentConsents: [] }, encounter: { ...value.encounter, enemy: null, story: "", facts: [] } }} />);
    expect(screen.queryByRole("region", { name: "织梦人当前原场" })).toBeNull(); expect(screen.queryByRole("region", { name: "织梦人原人遭遇" })).toBeNull();
  });

  it("shows believed and recognized image feedback separately and sends an explicit stop only once", () => {
    const stop = action({ type: "STOP_IMAGE" }, "明确停止本次梦像", "0行动 · 1秒");
    const value = activate(projection({ promoted: true, actions: [stop] }), "woven-bell", attempt({ imageAttempted: true, imageCreated: true, imageBelieved: true, owenMindSpent: 2, spiritualitySpent: 6 }));
    value.life.practice!.image = { id: "DWV3-BELL-IMAGE", source: "KNOWN_ORIGINAL_BELL", targetId: "DWV3-OWEN", believed: true };
    const { defaults, rerender, onCommand } = panel(value);
    let images = screen.getByRole("region", { name: "有限梦像与原铜铃" });
    for (const text of ["DWV3-BELL", "实体只有一个", "欧文当前相信", "可以明确停止", "形象不是现实造物"]) expect(images.textContent).toContain(text);
    const recognized = structuredClone(value); recognized.life.practice!.image!.believed = false; recognized.life.currentAttempt!.imageRecognized = true;
    rerender(<DreamWeaverPanel {...defaults} value={recognized} />); images = screen.getByRole("region", { name: "有限梦像与原铜铃" });
    expect(images.textContent).toContain("欧文已辨认，不再相信");
    expect(screen.getByRole("region", { name: "织梦人本次尝试与代价" }).textContent).toContain("欧文精神 2");
    expect(button("明确停止本次梦像").closest("details")).toBeNull(); fireEvent.click(button("明确停止本次梦像")); fireEvent.click(button("明确停止本次梦像"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command);
  });

  it("shows the actual failure cost and keeps the owner's ordinary return visible after identity failure", () => {
    const move = action({ type: "MOVE", actor: "OWNER", to: "NEAR" }, "本人沿普通路回近桌", "0行动 · 3秒");
    const create = action({ type: "CREATE_IDENTITY" }, "建立本次有限身份", "5灵性 · 2精神", { enabled: false, reason: "本次已失败，不能重骰；仍可普通走返。" });
    const value = activate(projection({ promoted: true, actions: [create, move] }), "original-message", attempt({ elapsedSeconds: 17, ownerTravelMetres: 9, identityAttempted: true, spiritualitySpent: 5, ownerMindSpent: 2, messageReadBy: "OWNER", messageTaken: true, messageChecked: true, messageReturned: true }));
    value.life.practice!.ownerNode = "FAR";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "织梦人本次尝试与代价" });
    for (const text of ["本次能力尝试失败", "已付灵性 5", "本人精神 2", "原纸已实际归还"]) expect(cost.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "织梦人当前原场" }).textContent).toContain("本人在原远桌");
    const exits = screen.getByRole("region", { name: "织梦人停止与普通退路" });
    expect(within(exits).getByRole("button", { name: /本人沿普通路回近桌/ }).closest("details")).toBeNull();
    fireEvent.click(button("建立本次有限身份")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("本人沿普通路回近桌")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(move.command); expect(value).toEqual(before);
  });

  it("allows local case browsing but uses the saved active case and never sends cleanup on page close", async () => {
    const value = projection({ promoted: true, actions: [] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await open("三项生活情境与原尝试记录");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择织梦人生活情境" }), "original-message");
    expect(screen.getByRole("region", { name: "当前织梦人生活情境" }).textContent).toContain("同一原留言");
    const active = activate(structuredClone(value), "woven-bell"); const before = structuredClone(active);
    rerender(<DreamWeaverPanel {...defaults} value={active} />);
    expect(screen.getByRole("region", { name: "当前织梦人生活情境" }).textContent).toContain("可停止的原铃梦像");
    expect((screen.getByRole("combobox", { name: "选择织梦人生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("关闭织梦人页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(active).toEqual(before);
  });

  it("keeps old personality, tears, gatherings, surrender and actual new mastery as read-only history", async () => {
    const value = projection({ promoted: true, actions: [] }), { onCommand } = panel(value);
    await open("原身体、旧人格与继承记录"); const history = screen.getByRole("region", { name: "织梦人继承记录" });
    for (const text of ["原操纵师消化100", "七滴泪只各用一次", "MP4-P1已归并", "旧鲁兰H100/M0已投降", "病势0", "本阶不改变性别", "旧同意不能继承"]) expect(history.textContent).toContain(text);
    const abilities = screen.getByRole("region", { name: "织梦人能力边界" });
    for (const text of ["有限外部身份 · 掌握 0", "有限织梦形象 · 掌握 8", "思想共通", "没有独立灵魂", "不复活伤亡", "洞察者2"]) expect(abilities.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("offers a clear peaceful exit and retains the original enemy's resources, disease and paid stabilization", async () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿普通出口和平离开", "0行动");
    const value = projection({ promoted: true, actions: [leave] }); value.encounter = { ...encounter(), inside: true, status: "READY", actions: [leave] };
    const { defaults, rerender, onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(true); expect(screen.queryByRole("region", { name: "当前织梦人生活情境" })).toBeNull();
    const scene = screen.getByRole("region", { name: "织梦人原人遭遇" });
    for (const text of ["45岁", "DWV3-OSMOND", "DWV3-OSMOND-CLUB", "健康 91", "精神 88", "独立灵性 103", "普通出口开放", "可识破与抵抗"]) expect(scene.textContent).toContain(text);
    expect(button("沿普通出口和平离开").closest("details")).toBeNull(); fireEvent.click(button("沿普通出口和平离开"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command);
    const aid = action({ type: "AID_ENEMY" }, "原奥斯蒙德自愿接受专业稳定", "1行动 · 40便士 · 每真实周一次");
    const ended = projection({ promoted: true, actions: [aid] }); ended.encounter = { ...encounter(), status: "RESOLVED", mentalPlague: 2,
      enemy: { ...encounter().enemy!, health: 60, mind: 0, spirituality: 29, status: "SURRENDERED", weaponLocation: "YARD" },
      helpHistory: [{ week: 91, before: 3, after: 2, fee: 40 }], actions: [aid] };
    rerender(<DreamWeaverPanel {...defaults} value={ended} />); await open("新原人的可选冲突");
    const history = screen.getByRole("region", { name: "织梦人原人遭遇" });
    for (const text of ["健康 60", "精神 0", "独立灵性 29", "已投降停止抵抗，仍是原人", "原精神瘟疫强度 2", "离场不自动清除", "第91周", "3→2", "40便士", "留在原院"]) expect(history.textContent).toContain(text);
    fireEvent.click(button("原奥斯蒙德自愿接受专业稳定")); expect(onCommand).toHaveBeenNthCalledWith(2, aid.command);
  });
});
