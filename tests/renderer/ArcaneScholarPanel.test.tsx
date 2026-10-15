/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcaneScholarPanel, type ArcaneScholarPanelProps } from "../../src/renderer/ArcaneScholarPanel";
import type { ArcaneScholarAction, ArcaneScholarCommand, ArcaneScholarProjection } from "../../src/domain/arcane-scholar/types";
import { ARCANE_SCHOLAR_CONSUMPTION_RISK } from "../../src/domain/arcane-scholar/content";

function action(command: ArcaneScholarCommand, label: string, cost = "0行动", extra: Partial<ArcaneScholarAction> = {}): ArcaneScholarAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取奥秘学者专业指导", "1行动 · 500便士");
const consume = (bottleId = "arcane-scholar-potion-1") => action({ type: "CONSUME", bottleId, confirmed: true }, `核对并服用${bottleId}`, "0行动 · 消耗这一原瓶");

/** Public renderer fixture only; not a natural playthrough or evidence of domain eligibility. */
function projection(extra: Partial<ArcaneScholarProjection> = {}): ArcaneScholarProjection {
  return {
    title: "奥秘学者3 · 有限研究与原物协同", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "本场有限解析与原物协同为本作G；编号由原文跨段推定。",
    supplies: "独立序列3成品三瓶；每瓶6200便士，五次实际劳务后800便士。补货须真实下一周。",
    actions: [guidance()], bottles: [1, 2, 3].map(number => ({ id: `arcane-scholar-potion-${number}`, title: `奥秘学者第${number}独立原瓶`,
      source: `独立序列3批次第${number}瓶，原封签AR3-SEAL-${number}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `arcane-scholar-potion-${number}`, confirmed: true as const } })),
    preparations: [
      { taskId: "INSPECT_RECORDS", title: "亲自查阅原制造与成本记录", completedWeek: 93 },
      { taskId: "CHECK_ORIGINALS", title: "实际核对两件唯一原件", completedWeek: 94 },
      { taskId: "PLAN_WITHDRAWAL", title: "实际演练停用与返回", completedWeek: 94 },
    ],
    preparedWeek: 95,
    abilities: [
      { id: "paragon.s3.bounded-analysis", label: "有限结构解析（G）", mastery: 0, description: "只比较已读原记录和两次可见测量。" },
      { id: "paragon.s3.construct-coordination", label: "两原造物协同（G）", mastery: 8, description: "30秒、6米，只用同时在场的两原件。" },
    ],
    acting: 0, digestion: "炼金术士消化100；从原晋升第83周起，已经过12/12真实整周。", pollution: 3, risk: ARCANE_SCHOLAR_CONSUMPTION_RISK,
    resources: { health: 83, maxHealth: 100, mind: 77, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE",
    inheritedHistory: ["炼金术士原消化100；旧能力原ID与掌握保留。", "原花园死植、沙化与干水已经发生，不能恢复。", "旧奥斯里克AL4-OSRIC已经死亡，原棍AL4-OSRIC-CLUB仍留YARD。", "旧包裹与黄铜片已经归还海伦娜。"],
    life: life(), encounter: encounter(), insideCase: false,
    environment: "同一AL4-WORKBENCH-1两米原台、一米原护架标记，原物各只有一个。",
    ...extra,
  };
}
function attempt(extra: Partial<NonNullable<ArcaneScholarProjection["life"]["currentAttempt"]>> = {}): NonNullable<ArcaneScholarProjection["life"]["currentAttempt"]> {
  return {
    week: 96, method: "ABILITY", consented: false, closed: false, result: "NONE", elapsedSeconds: 0,
    ownerTravelMetres: 0, boxTravelMetres: 0, recordsRead: false, baselines: [], analysisTier: null, boundedSetting: null,
    linkTier: null, linkRemainingSeconds: 0, linkStopped: false, noteTaken: false, noteDelivered: false, noteReturned: false,
    loadTriggered: false, loadStopped: false, manualStop: false, fuseId: null, spiritualitySpent: 0,
    boxChargeSpent: 0, frameChargeSpent: 0, frameDurabilityLost: 0, originalsReturned: false, ...extra,
  };
}
function life(): ArcaneScholarProjection["life"] {
  return {
    title: "有限研究与两件原物", source: "本场原创G", environment: "三案报告各25，反思25；只给实际成功对应能力掌握。",
    insideCase: false, reflected: false, currentAttempt: null, activeCase: null,
    workbenchId: "AL4-WORKBENCH-1", ownerNode: "BENCH_START",
    creations: [
      { id: "AL4-BOX-1", kind: "MESSENGER_BOX", source: "原80便士木板与黄铜轮轴亲手组装", componentIds: ["AL4-WOOD-1", "AL4-CELL-1"], madeBy: "original-run", owner: "PLAYER", custodian: "PLAYER", location: "PLAYER", durability: 100, charge: 2, active: false, manufacturedWeek: 84 },
      { id: "AL4-FRAME-1", kind: "GUARD_FRAME", source: "原120便士木材与钢片亲手制造", componentIds: ["AL4-WOOD-2", "AL4-CELL-2"], madeBy: "original-run", owner: "PLAYER", custodian: "PLAYER", location: "PLAYER", durability: 95, charge: 0, active: false, manufacturedWeek: 85 },
    ],
    note: { id: "AR3-TEST-NOTE", owner: "AR3-NELL", custodian: "AR3-NELL", location: "OWNER" },
    load: { deviceId: "AL4-PAD-1", handleId: "AR3-LOAD-HANDLE", status: "IDLE" }, fuses: [], recharges: [], actions: [],
    cases: ([
      { id: "tolerance-map", title: "两原件有限公差研究", story: "读取原制造记录，再在原台实际测量两次普通基准。" },
      { id: "timed-transfer", title: "同一原纸定时移送", story: "内尔本次同意后，原盒移动2米，原护架支撑开口，原纸须归还。" },
      { id: "fault-isolation", title: "低载荷失配停止", story: "先触发原装置，再实际停机，原熔片须回收。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null,
      contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function activate(value: ArcaneScholarProjection, caseId: ArcaneScholarProjection["life"]["cases"][number]["id"], current = attempt()) {
  value.insideCase = true; value.life.insideCase = true; value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function encounter(): ArcaneScholarProjection["encounter"] {
  return {
    title: "原科尔温的独立通行争议", story: "两具原身体相距2米；普通出口开放，无追逐、无旁人。", status: "AVAILABLE", inside: false,
    enemy: { id: "AR3-CORWIN", name: "科尔温", age: 47, sequence: 3, health: 91, mind: 88, spirituality: 103,
      status: "RESISTING", weaponId: "AR3-CORWIN-CLUB", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 3, JAM: 2 } },
    actions: [], facts: ["本次有限G3等效，不冒称已核原著能力表。", "原人离场不会恢复健康、精神或灵性。"],
  };
}
function panel(value = projection(), props: Partial<Omit<ArcaneScholarPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<ArcaneScholarPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
async function open(text: string) { await userEvent.click(screen.getByText(text, { selector: "summary" })); }
afterEach(cleanup);

describe("ArcaneScholarPanel committed research, originals and recovery", () => {
  it("leads with the actual promotion gate and never displays invented recipe ingredients", () => {
    const reason = "从实际晋4第83周起尚只有11/12整周，须真实下一周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应显示的假材料", quantity: 8, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "奥秘学者当前目标" }).textContent).toContain(reason);
    expect(button("听取奥秘学者专业指导").disabled).toBe(true);
    expect(button("听取奥秘学者专业指导").getAttribute("aria-describedby")).toContain("arcane-scholar-reason-");
    fireEvent.click(button("听取奥秘学者专业指导")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByText("不应显示的假材料")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps unknown recipe and old history in closed native details, with initial keyboard focus", async () => {
    const { onCommand } = panel();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "奥秘学者3 · 有限研究与原物协同" }));
    for (const label of ["独立成品与晋升准备", "原身体、旧园地与旧人记录", "原场地与普通生活"]) expect(fold(label).open).toBe(false);
    await open("独立成品与晋升准备"); expect(fold("独立成品与晋升准备").open).toBe(true);
    const boundary = screen.getByRole("region", { name: "奥秘学者成品与配方边界" });
    for (const text of ["只提供独立成品", "不提供完整配方或材料用量", "三项专业准备", "当周场地检查", "6200", "800", "第93周"]) expect(boundary.textContent).toContain(text);
    expect(within(boundary).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("submits once, ignores an identical cloned projection, and unlocks only on changed saved facts", () => {
    const value = projection(), before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button("听取奥秘学者专业指导")); fireEvent.click(button("听取奥秘学者专业指导"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
    expect(screen.getByRole("status").textContent).toContain("正在结算并保存");
    rerender(<ArcaneScholarPanel {...defaults} value={structuredClone(value)} />);
    fireEvent.click(button("听取奥秘学者专业指导")); expect(onCommand).toHaveBeenCalledOnce();
    const nextCommand: ArcaneScholarCommand = { type: "PREPARE_TASK", taskId: "INSPECT_RECORDS" };
    rerender(<ArcaneScholarPanel {...defaults} value={{ ...value, actions: [action(nextCommand, "实际查阅原记录", "1行动")] }} />);
    fireEvent.click(button("实际查阅原记录")); expect(onCommand).toHaveBeenNthCalledWith(2, nextCommand);
  });

  it.each(["busy", "blocked"] as const)("locks mutations, selection and page dismissal while %s", flag => {
    const { onCommand, onClose } = panel(projection(), { [flag]: true });
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) { expect(control.disabled).toBe(true); fireEvent.click(control); }
    expect((screen.getByRole("combobox", { name: "选择独立奥秘学者原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("shows actual resources before any collapsed history and never fills spirituality to its cap", () => {
    panel(); const resources = screen.getByRole("region", { name: "奥秘学者当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["83 / 100", "77 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(resources.textContent).not.toContain("120 / 120");
  });

  it("selects one original bottle and sends only that bottle's actual labour command", async () => {
    const commands: ArcaneScholarCommand[] = [{ type: "POTION_WORK", bottleId: "arcane-scholar-potion-1" }, { type: "POTION_WORK", bottleId: "arcane-scholar-potion-2" }];
    const value = projection({ actions: commands.map((command, index) => action(command, `第${index + 1}瓶实际劳动`, "1行动 · 本瓶劳务")) }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立奥秘学者原瓶" }), "arcane-scholar-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶实际劳动/ })).toBeNull(); fireEvent.click(button("第2瓶实际劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it("reviews one original bottle, real risk and unchanged sex, and restores focus on cancellation", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "奥秘学者原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "奥秘学者第1独立原瓶" }));
    for (const text of ["arcane-scholar-potion-1", "AR3-SEAL-1", "71%", "第95周", "本渠道仅提供独立成品，晋升仍须完成专业准备", "女性", "身体性别不改变", "当前灵性不补满", "成功或失败", "普通死亡"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("AR3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button("暂不服用")); expect(document.activeElement).toBe(button("核对并服用"));
  });

  it("Escape cancels only the unsubmitted review and never leaves the real preparation", async () => {
    const value = projection({ actions: [consume()] }), before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "奥秘学者原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("forwards the exact reviewed consume intent once and prevents Escape during its save", async () => {
    const value = projection({ actions: [consume()] }), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const confirm = button("确认服用这一原瓶"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "arcane-scholar-potion-1", confirmed: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(confirm.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "奥秘学者原瓶服用确认" })).toBeTruthy();
  });

  it("invalidates unsubmitted review if saved cost, resources or original bottle facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    const changes: ArcaneScholarProjection[] = [
      { ...value, actions: [{ ...consume(), cost: "新增实际成本" }] },
      { ...value, resources: { ...value.resources!, spirituality: 41 } },
      { ...value, bottles: value.bottles.map(bottle => ({ ...bottle, status: "原瓶已耗尽" })) },
    ];
    for (const changed of changes) {
      rerender(<ArcaneScholarPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<ArcaneScholarPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "奥秘学者原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative reason", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<ArcaneScholarPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原场尚有未归还原物。" }] }} />);
    const confirm = button("确认服用这一原瓶"); expect(confirm.disabled).toBe(true); expect(confirm.getAttribute("aria-describedby")).toBe("arcane-scholar-confirm-reason");
    expect(screen.getByRole("region", { name: "奥秘学者原瓶服用确认" }).textContent).toContain("未归还原物"); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it("holds the submitted original through save failure and directs retries to the outer control", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    rerender(<ArcaneScholarPanel {...defaults} error={{ message: "原服药保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("上次已保存的记录"); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ArcaneScholarPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
  });

  it("directs a nonretryable error to reload without sending a replacement or closing the page", () => {
    const { onCommand, onClose } = panel(projection(), { error: { message: "版本冲突", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(button("听取奥秘学者专业指导")); fireEvent.click(button("关闭奥秘学者页面")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the one inherited box and frame with actual charge, durability and location before history", () => {
    const value = projection({ promoted: true, actions: [action({ type: "RECHARGE", objectId: "AL4-FRAME-1" }, "补能这一原护架", "1行动 · 40便士 · 3灵性")] });
    const before = structuredClone(value), { onCommand } = panel(value);
    const originals = screen.getByRole("region", { name: "两件唯一原造物" });
    expect(originals.closest("details")).toBeNull();
    for (const text of ["AL4-BOX-1", "AL4-FRAME-1", "储能 2 / 3", "储能 0 / 3", "耐久 95 / 100", "本人随身", "已停用", "各只有一份", "不修复耐久"]) expect(originals.textContent).toContain(text);
    expect(originals.textContent).not.toContain("储能 3 / 3");
    fireEvent.click(button("补能这一原护架")); fireEvent.click(button("补能这一原护架"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RECHARGE", objectId: "AL4-FRAME-1" });
    expect(originals.textContent).toContain("储能 0 / 3"); expect(value).toEqual(before);
  });

  it("reveals only actually read records and measured data, then the saved limited setting", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "tolerance-map");
    const { defaults, rerender } = panel(value);
    let study = screen.getByRole("region", { name: "实际资料与有限研究" });
    expect(study.textContent).toContain("尚未实际阅读"); expect(study.textContent).toContain("尚无本次基准读数");
    expect(study.textContent).not.toContain("开口 18 毫米"); expect(study.textContent).toContain("尚未取得有限匹配设置");
    const next = structuredClone(value);
    next.life.currentAttempt = attempt({ recordsRead: true, baselines: [
      { sample: 1, boxTravelMetres: 4, transferSeconds: 8, openingMm: 18 }, { sample: 2, boxTravelMetres: 4, transferSeconds: 9, openingMm: 17 },
    ], analysisTier: "SUCCESS", boundedSetting: "原盒限速8秒，原架固定开口17毫米", spiritualitySpent: 4 });
    const before = structuredClone(next); rerender(<ArcaneScholarPanel {...defaults} value={next} />);
    study = screen.getByRole("region", { name: "实际资料与有限研究" });
    for (const text of ["已实际阅读两原件", "第1次普通基准", "第2次普通基准", "移送用时 8 秒", "移送用时 9 秒", "开口 18 毫米", "开口 17 毫米", "有限解析：成功", "原盒限速8秒"]) expect(study.textContent).toContain(text);
    expect(next).toEqual(before);
  });

  it("keeps failed analysis and its real cost when ordinary comparison remains available", () => {
    const command: ArcaneScholarCommand = { type: "COMPARE_READINGS", caseId: "tolerance-map" };
    const value = activate(projection({ promoted: true, actions: [action(command, "普通比较两次原读数")] }), "tolerance-map",
      attempt({ recordsRead: true, analysisTier: "FAILURE", spiritualitySpent: 4, elapsedSeconds: 20 }));
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "奥秘学者本次尝试与代价" });
    for (const text of ["本次能力尝试失败", "已付灵性 4", "尚无完成结果", "实际经过 20 秒"]) expect(cost.textContent).toContain(text);
    fireEvent.click(button("普通比较两次原读数")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.getByRole("region", { name: "实际资料与有限研究" }).textContent).toContain("有限解析：失败");
    expect(cost.textContent).not.toContain("普通方法完成"); expect(value).toEqual(before);
  });

  it("separates the original paper holder, actual delivery and finite link from stopping intent", () => {
    const stop: ArcaneScholarCommand = { type: "STOP_LINK", caseId: "timed-transfer" };
    const value = activate(projection({ promoted: true, actions: [action(stop, "明确停止本次协同")] }), "timed-transfer",
      attempt({ consented: true, noteTaken: true, noteDelivered: true, linkTier: "SUCCESS", linkRemainingSeconds: 18, spiritualitySpent: 5, boxChargeSpent: 1, frameChargeSpent: 1, boxTravelMetres: 2 }));
    value.life.note.custodian = "AL4-BOX-1"; value.life.note.location = "BENCH_END";
    value.life.creations[0]!.location = "BENCH_END"; value.life.creations[1]!.location = "GUARD_MARK";
    const before = structuredClone(value), { onCommand } = panel(value);
    const paper = screen.getByRole("region", { name: "唯一受托原测试纸" }), link = screen.getByRole("region", { name: "有限协同当前状态" });
    for (const text of ["AR3-TEST-NOTE", "AR3-NELL", "唯一原盒承载", "原台终点", "已经实际送达", "仍须核对并归还"]) expect(paper.textContent).toContain(text);
    expect(link.textContent).toContain("剩余 18 秒"); expect(link.textContent).toContain("30秒与6米为上限");
    fireEvent.click(button("明确停止本次协同")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop);
    expect(link.textContent).toContain("剩余 18 秒"); expect(paper.textContent).not.toContain("原纸已亲手归还内尔"); expect(value).toEqual(before);
  });

  it("shows failed load coordination, paid spent fuse and real damage while preserving manual stop", () => {
    const command: ArcaneScholarCommand = { type: "MANUAL_STOP", caseId: "fault-isolation" };
    const value = activate(projection({ promoted: true, actions: [action(command, "本人拉下原停机手柄")] }), "fault-isolation",
      attempt({ consented: true, loadTriggered: true, fuseId: "AR3-FUSE-1", linkTier: "FAILURE", spiritualitySpent: 5, boxChargeSpent: 1, frameChargeSpent: 1, frameDurabilityLost: 5 }));
    value.life.load.status = "RUNNING"; value.life.creations[1]!.durability = 90;
    value.life.fuses = [{ id: "AR3-FUSE-1", source: "本次实际购入的限位原熔片", paidPennies: 20, week: 96, attempt: 1, consumed: true, location: "LOAD_DEVICE" }];
    const before = structuredClone(value), { onCommand } = panel(value);
    const load = screen.getByRole("region", { name: "原低载荷装置与熔片" }), cost = screen.getByRole("region", { name: "奥秘学者本次尝试与代价" });
    for (const text of ["AL4-PAD-1", "AR3-LOAD-HANDLE", "正在低载荷运行", "已实际触发", "AR3-FUSE-1", "已付 20便士", "已实际消耗", "仍在原装置"]) expect(load.textContent).toContain(text);
    for (const text of ["已付灵性 5", "原盒储能消耗 1", "原护架储能消耗 1", "原护架耐久损失 5"]) expect(cost.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "奥秘学者停止与普通退路" }).contains(button("本人拉下原停机手柄"))).toBe(true);
    fireEvent.click(button("本人拉下原停机手柄")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(load.textContent).toContain("正在低载荷运行"); expect(value).toEqual(before);
  });

  it("does not invent a purchased fuse, consent, stop result or repaired creation", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "fault-isolation");
    value.life.creations[1]!.durability = 0;
    const before = structuredClone(value); panel(value);
    const load = screen.getByRole("region", { name: "原低载荷装置与熔片" });
    expect(load.textContent).toContain("本次尚未取得原熔片"); expect(load.textContent).toContain("本次尚未实际触发");
    expect(load.textContent).not.toContain("已付 20便士"); expect(load.textContent).not.toContain("本人已用原手柄普通停机");
    expect(screen.getByRole("region", { name: "奥秘学者当前原场" }).textContent).toContain("尚无本次已保存同意");
    expect(screen.getByRole("region", { name: "两件唯一原造物" }).textContent).toContain("耐久 0 / 100"); expect(value).toEqual(before);
  });

  it("keeps old deaths, damage and actual recharge receipts folded without mutating or extending consent", async () => {
    const value = projection({ promoted: true, actions: [] });
    value.life.recharges = [{ id: "AR3-CHARGE-1", materialId: "AR3-ENERGY-1", source: "本次原補能材料", objectId: "AL4-FRAME-1", week: 96,
      paidPennies: 40, spiritualitySpent: 3, previousCharge: 0, resultingCharge: 3, durabilityBefore: 95, durabilityAfter: 95, materialConsumed: true }];
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("原身体、旧园地与旧人记录").open).toBe(false); expect(fold("原造物来源、实际补能与材料").open).toBe(false);
    await open("原身体、旧园地与旧人记录");
    const history = screen.getByRole("region", { name: "奥秘学者继承记录" });
    for (const text of ["死植", "沙化", "干水", "AL4-OSRIC已经死亡", "AL4-OSRIC-CLUB", "已经归还海伦娜", "不复活"]) expect(history.textContent).toContain(text);
    await open("原造物来源、实际补能与材料"); const receipts = screen.getByRole("region", { name: "奥秘学者原物与补能记录" });
    for (const text of ["AR3-ENERGY-1", "已付40便士和3灵性", "材料已消耗", "储能 0→3", "耐久 95→95"]) expect(receipts.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("locks case switching in a real scene and keeps view dismissal separate from returning originals", async () => {
    const command: ArcaneScholarCommand = { type: "RETURN_ORIGINALS", caseId: "timed-transfer" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手取回同两原件"), action({ type: "MANUAL_STOP", caseId: "fault-isolation" }, "另一案原手柄")] }), "timed-transfer");
    value.life.creations[0]!.location = "BENCH_END";
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    expect(screen.queryByRole("button", { name: /^另一案原手柄/ })).toBeNull();
    await open("三项研究情境与原尝试记录");
    expect((screen.getByRole("combobox", { name: "选择奥秘学者生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("关闭奥秘学者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    fireEvent.click(button("亲手取回同两原件")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.getByRole("region", { name: "两件唯一原造物" }).textContent).toContain("原台终点"); expect(value).toEqual(before);
  });

  it("shows the independent living enemy, exact weapon location and ordinary exit without restoring the old enemy", () => {
    const leave: ArcaneScholarCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(leave, "带回自己的原件并普通离开")] });
    value.encounter.inside = true; value.encounter.status = "READY";
    for (const original of value.life.creations) original.location = "YARD";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(true);
    const encounter = screen.getByRole("region", { name: "奥秘学者原人遭遇" });
    for (const text of ["科尔温", "47岁", "AR3-CORWIN", "健康 91", "精神 88", "独立灵性 103", "AR3-CORWIN-CLUB", "仍在原人手中", "旧奥斯里克分别保存", "普通出口开放"]) expect(encounter.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "奥秘学者当前原场" })).toBeNull();
    fireEvent.click(button("带回自己的原件并普通离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave);
    expect(screen.getByRole("region", { name: "两件唯一原造物" }).textContent).toContain("原工院"); expect(value).toEqual(before);
  });
});
