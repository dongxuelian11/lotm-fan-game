/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeaKingPanel, type SeaKingPanelProps } from "../../src/renderer/SeaKingPanel";
import type { SeaKingAction, SeaKingCommand, SeaKingProjection } from "../../src/domain/sea-king/types";
import { SEA_KING_CONSUMPTION_RISK } from "../../src/domain/sea-king/content";

type Attempt = NonNullable<SeaKingProjection["life"]["currentAttempt"]>;
type CaseId = SeaKingProjection["life"]["cases"][number]["id"];
function action(command: SeaKingCommand, label: string, cost = "0行动", extra: Partial<SeaKingAction> = {}): SeaKingAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取海王专业指导", "1行动 · 500便士");
const consume = (id = "sea-king-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 98, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, abilityTier: null,
    ownerConsent: "UNASKED", ownerConsentWeek: null, orinConsent: "UNASKED", orinConsentWeek: null,
    siteVisited: false, chartRead: false, boundaryChecked: false, itemsReturned: false, inspected: false, refused: false,
    rowedOut: false, returnedBy: null, boatSecured: false, boatTravelMetres: 0, orinEnergySpent: 0,
    assistantChecked: false, waterMoved: false, windowRemaining: 0, windowElapsed: 0, waterReturned: false,
    plateTaken: false, plateReturned: false, retrieval: null, hookWear: 0, windlassWear: 0,
    calmChecked: false, fragments: [], hypothesis: null, hypothesisHistory: [], selmaAsked: false, orinAsked: false, ownerEvidenceRead: false, recordReturned: false, verified: false, ...extra };
}
function life(): SeaKingProjection["life"] {
  return { title: "海王有限海域实践G", story: "三项原创G实践", environment: "原干岸、同一真实海水与普通出口。",
    activeCase: null, inside: false, insideCase: false, reflected: false, clockSeconds: 0, playerLocation: "EXIT", playerTravelMetres: 0,
    selma: { id: "SK3-SELMA", name: "塞尔玛", age: 44, alive: true, willing: true, location: "EXIT" },
    orin: { id: "SK3-ORIN", name: "奥林", age: 39, alive: true, willing: true, present: true, location: "PIER", energy: 100, travelMetres: 0 },
    chart: { id: "SK3-CHART", owner: "SK3-SELMA", location: "OWNER" }, buoys: { id: "SK3-BOUNDARY-BUOYS", originalCount: 2, boundaryMetres: 96, fixed: true },
    dinghy: { id: "SK3-DINGHY", owner: "SK3-SELMA", location: "PIER", occupant: null, cargoUnits: 0, hull: 100, travelMetres: 0 },
    mooring: { id: "SK3-MOORING", owner: "SK3-SELMA", tied: true, durability: 100 },
    recess: { id: "SK3-RECESS", connectedTo: "SK3-COVE", waterUnits: 20, displacedToCove: 0 },
    plate: { id: "SK3-PLATE", owner: "SK3-SELMA", location: "RECESS" }, hook: { id: "SK3-HOOK", owner: "SK3-SELMA", location: "OWNER", durability: 100 },
    windlass: { id: "SK3-WINDLASS", owner: "SK3-SELMA", location: "OWNER", durability: 100 }, barrel: { id: "SK3-BARREL", owner: "SK3-SELMA", location: "SIDE_BERTH" },
    handoverRecord: { id: "SK3-HANDOVER", owner: "SK3-SELMA", location: "OWNER" }, currentAttempt: null, actions: [],
    cases: ([
      { id: "remote-dinghy", title: "同一原艇的六十米往返", story: "原奥林自愿划同一原艇，有限助返或普通划返后系原缆。" },
      { id: "wet-recess", title: "原凹槽的二十单位海水", story: "取得许可，确认原助手与真实水源，有限移水或普通取牌。" },
      { id: "calm-water-record", title: "水面片段与原签注", story: "原浮桶昨天到了旁泊位，须真实调查才能核实原因。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): SeaKingProjection["encounter"] {
  return { title: "原干燥码头与独立的昆廷", story: "2米净空原干燥码头，实际普通出口开放，无追逐。", status: "AVAILABLE", inside: false, waterSource: "SEAWATER",
    enemy: { id: "SK3-QUENTIN", name: "昆廷", age: 49, source: "ORIGINAL_DRY_QUAY_ADULT", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "SK3-QUENTIN-CLUB", weaponLocation: "HAND", powerUses: { WIND: 1, WATER_WARD: 2, FOCUS: 1 } },
    actions: [], facts: ["实际普通出口开放，无追逐。", "本轮专注只抵下一次成功风水压力，不抵雷。"] };
}
/** Public renderer fixture only; it is not domain eligibility or a natural gameplay replay. */
function projection(extra: Partial<SeaKingProjection> = {}): SeaKingProjection {
  return { title: "海王·暴君序列3（有限海域G）", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "海王序列3已核实，有限海域定量与故事为G。", supplies: "三瓶独立成品各6200便士，或各五次劳务后800便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `sea-king-potion-${n}`, title: `海王第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签SK3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `sea-king-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_CHART", title: "原海图与水源核对", completedWeek: 82 },
      { taskId: "SET_BOUNDARY", title: "实测有限边界", completedWeek: 83 }, { taskId: "PLAN_RETURN", title: "普通返程核对", completedWeek: 83 }],
    preparedWeek: 84, abilities: [{ id: "tyrant.s3.sea-domain", label: "有限海域控水（G）", mastery: 8, description: "只移动真实相连海水，并保留普通岸路。" },
      { id: "tyrant.s3.remote-tempest", label: "有限遥距风力（G）", mastery: 0, description: "只在实测边界内帮助同一原艇返程。" }],
    acting: 0, digestion: "原灾难主祭消化100，从第84周晋升已过12整周。", pollution: 3, risk: SEA_KING_CONSUMPTION_RISK,
    resources: { health: 70, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧本尼迪克特CP4-BENEDICT已DEAD，健康0，原棍留QUAY。", "旧西尔瓦与原浮具BANK、绳耐90、原布已收回。", "原盘1水单位、原石1焦痕、各处原海岸损毁保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "实际海湾、干燥岸路和普通出口。", ...extra };
}
function activate(value: SeaKingProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<SeaKingPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<SeaKingPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("SeaKingPanel verified S3, limited sea and original-object continuity", () => {
  it("leads with real readiness and resources, folding detailed rules and hiding unknown recipe materials", () => {
    const reason = "从原灾难主祭晋升起仅11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应出现的假材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain(reason);
    expect(button("听取海王专业指导").disabled).toBe(true);
    expect(button("听取海王专业指导").getAttribute("aria-describedby")).toContain("sea-king-reason-");
    const resources = screen.getByRole("region", { name: "海王当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["70 / 100", "85 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不应出现的假材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "有限海域能力与使用范围", "原身体、旧本尼迪克特与原物", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取海王专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps independent medicine, separate Calamity promotion and read-only S4 history", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain("序列3海王");
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain("下一序列2天灾仍须另行晋升，本页不直接授予其能力");
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "海王成品与配方边界" });
    for (const text of ["灾难主祭4 → 海王3 → 天灾2", "完整配方", "6200", "800", "500便士", "120便士", "12整周", "第82周", "原消化100", "三项不同准备各1行动", "0行动独立确认服用所选原瓶", "普通死亡", "旧序列4的地震海啸仪式不会作为本阶任务重做"]) expect(boundary.textContent).toContain(text);
    await open("原身体、旧本尼迪克特与原物");
    const history = screen.getByRole("region", { name: "海王继承记录" });
    for (const text of ["女性", "CP4-BENEDICT已DEAD", "健康0", "原棍留QUAY", "浮具BANK", "绳耐90", "原布已收回", "原盘1水单位", "原石1焦痕", "海岸损毁"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and emits its exact original labour intent without mutating it", async () => {
    const commands: SeaKingCommand[] = [{ type: "POTION_WORK", bottleId: "sea-king-potion-1" }, { type: "POTION_WORK", bottleId: "sea-king-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立海王原瓶" }), "sea-king-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews only one original bottle, risk and actual resources, then cancels with Escape and restores focus", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "海王原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "海王第1独立原瓶" }));
    for (const text of ["sea-king-potion-1", "SK3-SEAL-1", "71%", "第84周", "成功或失败", "性别不改变", "当前灵性不补满", "普通死亡", "0行动", "意志难度30", "大成功", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("SK3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "海王原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits one confirmed intent and keeps it locked through failed save until a changed committed projection arrives", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<SeaKingPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "海王原瓶服用确认" })).toBeTruthy();
    rerender(<SeaKingPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = [];
    saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<SeaKingPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "海王原瓶服用确认" })).toBeNull();
    expect(button("关闭海王页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });


  it("keeps a failed original bottle spent and resumes real labour on another bottle without changing current resources", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, defaults, rerender } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    const saved = structuredClone(value); saved.preparedWeek = null;
    saved.bottles[0]!.status = "原瓶已耗尽 · 晋升失败";
    saved.bottles[1]!.status = "仍在原供应人处 · 劳务0/5";
    saved.resources = { ...saved.resources!, health: 55, mind: 60 };
    const work: SeaKingCommand = { type: "POTION_WORK", bottleId: "sea-king-potion-2" };
    saved.actions = [action(work, "为第二独立原瓶实际劳务", "1行动")];
    rerender(<SeaKingPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "海王原瓶服用确认" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择独立海王原瓶" }) as HTMLSelectElement).value).toBe("sea-king-potion-2");
    expect(screen.getByRole("region", { name: "海王当前资源" }).textContent).toContain("55 / 100");
    await open("独立成品与晋升准备");
    expect(screen.getByRole("region", { name: "海王成品与配方边界" }).textContent).toContain("原瓶已耗尽 · 晋升失败");
    const before = structuredClone(saved); fireEvent.click(button("为第二独立原瓶实际劳务"));
    expect(onCommand).toHaveBeenLastCalledWith(work); expect(onCommand).toHaveBeenCalledTimes(2); expect(saved).toEqual(before);
  });

  it("invalidates an unsubmitted review when the original cost or resource facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    for (const changed of [{ ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, resources: { ...value.resources!, spirituality: 41 } }]) {
      rerender(<SeaKingPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<SeaKingPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "海王原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative blocker", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<SeaKingPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原现场尚未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true);
    expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("sea-king-confirm-reason");
    expect(screen.getByRole("region", { name: "海王原瓶服用确认" }).textContent).toContain("原现场尚未收束");
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("locks commands, selectors and dismissal during pending recovery: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("听取海王专业指导").disabled).toBe(true); expect(button("关闭海王页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立海王原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("听取海王专业指导")); fireEvent.click(button("关闭海王页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });


  it.each([
    [{ type: "PREPARE_TASK", taskId: "CHECK_CHART" }, "亲自核对原海图", "1行动"],
    [{ type: "PREPARE_PROMOTION" }, "检查本周服药场地", "1行动 · 120便士"],
    [{ type: "REQUEST_SUPPLY" }, "向原渠道申请补货", "1行动 · 须跨真实周"],
    [{ type: "RECEIVE_SUPPLY" }, "接收同渠道新原瓶", "0行动 · 原封签独立保存"],
  ] as const)("forwards acquisition costs and supply intent unchanged: %j", (command, label, cost) => {
    const value = projection({ actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("shows current selected-case stages and leaves a new case unstarted until its typed intent is submitted", async () => {
    const commands: SeaKingCommand[] = [{ type: "OBSERVE", caseId: "remote-dinghy" }, { type: "OBSERVE", caseId: "wet-recess" }];
    const value = projection({ promoted: true, actions: commands.map((command, i) => action(command, i ? "观察原凹槽" : "观察原艇与划手", "1行动")) });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择海王生活情境" }), "wet-recess");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察原艇与划手/ })).toBeNull();
    const scene = screen.getByRole("region", { name: "当前海王生活情境" });
    expect(scene.textContent).toContain("观察、准备、实施与报告各1行动"); expect(scene.textContent).toContain("现场子步0行动");
    fireEvent.click(button("观察原凹槽")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it.each(["原周目已经结束，仅可查看。", "角色已经死亡，原记录只读保留。"])("honours the authoritative ended/dead blocker: %s", reason => {
    const command: SeaKingCommand = { type: "OBSERVE", caseId: "remote-dinghy" };
    const value = projection({ promoted: true, actions: [action(command, "观察原艇与划手", "1行动", { enabled: false, reason })] });
    const { onCommand } = panel(value);
    expect(button("观察原艇与划手").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain(reason);
    fireEvent.click(button("观察原艇与划手")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: "PREPARE", caseId: "remote-dinghy", method: "ABILITY" }, "本次准备有限风力", "1行动 · 须留足2行动"],
    [{ type: "PERFORM", caseId: "remote-dinghy" }, "进入真实原艇现场", "1行动"],
    [{ type: "REPORT", caseId: "remote-dinghy" }, "报告本次原艇实际结果", "1行动"],
  ] as const)("keeps the outer stage action distinct from zero-action substeps: %j", (command, label, cost) => {
    const value = projection({ promoted: true, actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows independent Quentin, his original weapon and actual water source with an ordinary exit", async () => {
    const command: SeaKingCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(command, "沿原干燥出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.waterSource = "NONE";
    const before = structuredClone(value), { onCommand } = panel(value);
    const original = screen.getByRole("region", { name: "海王原人遭遇" });
    for (const text of ["昆廷", "49岁", "SK3-QUENTIN", "健康 90", "精神 100", "独立灵性 103 / 120", "SK3-QUENTIN-CLUB", "仍在原人手中", "旧本尼迪克特分别保存", "没有可用真实海水", "普通回退", "原干燥出口开放"]) expect(original.textContent).toContain(text);
    expect(fold("本场范围与战斗代价").open).toBe(false); await open("本场范围与战斗代价");
    for (const text of ["各自实际灵性", "不免费施术", "共同轮盘", "不是全游戏自动排除友军伤害"]) expect(original.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前海王生活情境" })).toBeNull();
    fireEvent.click(button("沿原干燥出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("folds optional combat away from the active life objective and opens it without starting a fight", async () => {
    const command: SeaKingCommand = { type: "ENCOUNTER_TALK" };
    const value = projection({ promoted: true, actions: [action(command, "前往原昆廷处交谈", "1行动 · 另留开战1行动"),
      action({ type: "OBSERVE", caseId: "remote-dinghy" }, "观察原艇与划手", "1行动")] }), before = structuredClone(value), { onCommand } = panel(value);
    const optionalFold = fold("新原人的可选冲突"), talk = button("前往原昆廷处交谈");
    // Closed details descendants remain in JSDOM's role tree; verify structure and native open state explicitly.
    expect(optionalFold.open).toBe(false); expect(talk.closest("details")).toBe(optionalFold);
    expect(screen.getByRole("region", { name: "海王当前行动" }).contains(talk)).toBe(false);
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain("下一步：观察原艇与划手");
    await open("新原人的可选冲突"); expect(optionalFold.open).toBe(true); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(talk); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("does not expose original scene detail or clues before the initial observation", () => {
    const value = projection({ promoted: true, actions: [action({ type: "OBSERVE", caseId: "calm-water-record" }, "观察原水面", "1行动")] });
    const { container } = panel(value);
    fireEvent.change(screen.getByRole("combobox", { name: "选择海王生活情境" }), { target: { value: "calm-water-record" } });
    expect(screen.queryByRole("region", { name: "海王原人原物与普通退路" })).toBeNull();
    for (const text of ["蓝布", "一声铃", "SK3-HANDOVER", "奥林为靠船"]) expect(container.textContent).not.toContain(text);
  });

  it("shows a real current consent request before any original boat departure", () => {
    const command: SeaKingCommand = { type: "CONSENT_ORIN", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面问原奥林本次是否愿意", "0行动 · 实际1秒"),
      action({ type: "ROW_OUT", caseId: "remote-dinghy" }, "由原奥林实际划出", "0行动 · 奥林精力12", { enabled: false, reason: "须取得原人当前自愿。" })] }), "remote-dinghy", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 98, siteVisited: true }));
    value.life.playerLocation = "PIER"; value.life.chart.location = "PLAYER";
    const before = structuredClone(value), { onCommand } = panel(value);
    const boat = screen.getByRole("region", { name: "同一原艇与实际划手" });
    for (const text of ["奥林", "39岁", "SK3-ORIN", "当前在原干燥码头", "剩余精力 100", "本次尚未当面询问", "SK3-DINGHY", "船上无人", "本次尚未实际出发", "不能算作能力成功"]) expect(boat.textContent).toContain(text);
    expect(button("由原奥林实际划出").disabled).toBe(true);
    fireEvent.click(button("当面问原奥林本次是否愿意")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("preserves an original rower's refusal and offers ordinary withdrawal without a fake voyage", () => {
    const command: SeaKingCommand = { type: "RETURN_PLAYER", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "尊重拒绝并普通走回出口", "0行动 · 4米/4秒"),
      action({ type: "ROW_OUT", caseId: "remote-dinghy" }, "再次要求原人出发", "0行动", { enabled: false, reason: "原人已拒绝本次用途。" })] }), "remote-dinghy", attempt({ orinConsent: "DECLINED", refused: true }));
    value.life.orin.willing = false; value.life.playerLocation = "PIER";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "同一原艇与实际划手" }).textContent).toContain("奥林已拒绝继续本次用途");
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(button("再次要求原人出发").disabled).toBe(true);
    fireEvent.click(button("尊重拒绝并普通走回出口")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps the original rower aboard at sixty metres and permits ordinary rowing after failed magic with no AP or spirituality", () => {
    const command: SeaKingCommand = { type: "ROW_RETURN", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "同一原人普通划返60米", "0行动 · 60秒 · 奥林精力12")] }), "remote-dinghy", attempt({ ownerConsent: "GRANTED", orinConsent: "GRANTED", chartRead: true, boundaryChecked: true,
      rowedOut: true, boatTravelMetres: 60, orinEnergySpent: 12, abilityTier: "FAILURE", spiritualitySpent: 6 }));
    value.life.playerLocation = "PIER"; value.life.orin.location = "DINGHY"; value.life.orin.energy = 88; value.life.orin.travelMetres = 60;
    value.life.dinghy.location = "MARK"; value.life.dinghy.occupant = "SK3-ORIN"; value.life.dinghy.travelMetres = 60; value.life.mooring.tied = false;
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0, mind: 0 };
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const boat = screen.getByRole("region", { name: "同一原艇与实际划手" });
    for (const text of ["当前在同一原艇中", "在六十米外原浮标处", "船上只有同一原奥林", "剩余精力 88", "累计实走 60 米", "尚未系回", "尚无返程完成记录"]) expect(boat.textContent).toContain(text);
    const cost = screen.getByRole("region", { name: "海王本次尝试与代价" });
    for (const text of ["本案唯一能力判定：失败", "不能重骰", "已付灵性 6", "实付精力 12"]) expect(cost.textContent).toContain(text);
    expect(button("同一原人普通划返60米").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "海王停止与普通收束" }).contains(button("同一原人普通划返60米"))).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择海王生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("关闭海王页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("同一原人普通划返60米")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("requires the returned original boat to be tied before the rower is shown back ashore", () => {
    const command: SeaKingCommand = { type: "TIE_BOAT", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "系回同一原缆并让原人下艇", "0行动 · 实际2秒")] }), "remote-dinghy", attempt({ rowedOut: true, returnedBy: "WIND", boatTravelMetres: 120, orinEnergySpent: 16, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.playerLocation = "PIER"; value.life.dinghy.occupant = "SK3-ORIN"; value.life.dinghy.travelMetres = 120; value.life.dinghy.hull = 91;
    value.life.orin.location = "DINGHY"; value.life.orin.energy = 84; value.life.mooring.tied = false; value.life.mooring.durability = 93;
    const before = structuredClone(value), { onCommand } = panel(value);
    const boat = screen.getByRole("region", { name: "同一原艇与实际划手" });
    for (const text of ["当前在同一原艇中", "有限风力助返", "船体 91", "耐久 93", "尚未系回"]) expect(boat.textContent).toContain(text);
    fireEvent.click(button("系回同一原缆并让原人下艇")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows conserved original water, remaining seconds and tool wear, allowing an immediate zero-AP stop", () => {
    const command: SeaKingCommand = { type: "STOP_WATER", caseId: "wet-recess" };
    const value = activate(projection({ promoted: true, actions: [action(command, "停止作用让同一原水返回", "0行动 · 原20单位水返回")] }), "wet-recess", attempt({ ownerConsent: "GRANTED", assistantChecked: true, waterMoved: true, windowRemaining: 18, windowElapsed: 2,
      plateTaken: true, retrieval: "HOOK", hookWear: 1, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.playerLocation = "LEDGE"; value.life.recess.waterUnits = 0; value.life.recess.displacedToCove = 20; value.life.plate.location = "PLAYER";
    value.life.hook.location = "PLAYER"; value.life.hook.durability = 99; value.life.windlass.location = "PLAYER";
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const water = screen.getByRole("region", { name: "原海水与同一标牌工具" });
    for (const text of ["槽内 0 单位水", "暂移海湾 20 单位水", "窗口剩余 18 秒", "已实际经过 2 秒", "相连海湾", "SK3-PLATE", "在本人手中", "SK3-HOOK", "耐久 99", "SK3-WINDLASS", "耗2秒、耐久1"]) expect(water.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "海王停止与普通收束" }).contains(button("停止作用让同一原水返回"))).toBe(true);
    fireEvent.click(button("停止作用让同一原水返回")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps twenty actual water units after failed diversion and exposes the real ordinary tool cost", () => {
    const command: SeaKingCommand = { type: "TOOL_RETRIEVE", caseId: "wet-recess" };
    const value = activate(projection({ promoted: true, actions: [action(command, "用原普通卷具取同一原牌", "0行动 · 6秒 · 原卷具耐久−2"),
      action({ type: "TAKE_PLATE", caseId: "wet-recess" }, "趁窗口用短钩取牌", "0行动 · 2秒 · 耐久−1", { enabled: false, reason: "没有原水移开的真实窗口。" })] }), "wet-recess", attempt({ assistantChecked: true, abilityTier: "GREAT_FAILURE", spiritualitySpent: 6 }));
    value.life.playerLocation = "LEDGE"; value.life.windlass.location = "PLAYER";
    const before = structuredClone(value), { onCommand } = panel(value);
    const water = screen.getByRole("region", { name: "原海水与同一标牌工具" });
    for (const text of ["槽内 20 单位水", "暂移海湾 0 单位水", "窗口剩余 0 秒", "本次没有移开原水", "不能视为干地", "在原浅凹槽"]) expect(water.textContent).toContain(text);
    expect(button("趁窗口用短钩取牌").disabled).toBe(true); expect(button("用原普通卷具取同一原牌").textContent).toContain("6秒 · 原卷具耐久−2");
    fireEvent.click(button("用原普通卷具取同一原牌")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("preserves returned water and worn original tools through a real dry-bank return", () => {
    const command: SeaKingCommand = { type: "RETURN_PLAYER", caseId: "wet-recess" };
    const value = activate(projection({ promoted: true, actions: [action(command, "携同一原牌原工具走回出口", "0行动 · 4米/4秒")] }), "wet-recess", attempt({ assistantChecked: true, waterMoved: true, waterReturned: true, windowElapsed: 20,
      plateTaken: true, retrieval: "WINDLASS", windlassWear: 2, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.playerLocation = "LEDGE"; value.life.plate.location = "PLAYER"; value.life.hook.location = "PLAYER"; value.life.windlass.location = "PLAYER"; value.life.windlass.durability = 98;
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const water = screen.getByRole("region", { name: "原海水与同一标牌工具" });
    for (const text of ["同一20单位水已回原凹槽", "耐久 98", "本次已实际取起，仍须交还", "沿4米干岸携原物回出口交还"]) expect(water.textContent).toContain(text);
    fireEvent.click(button("携同一原牌原工具走回出口")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("reveals no water fragment or culprit before actual calm observation and ability result", () => {
    const command: SeaKingCommand = { type: "CHECK_CALM", caseId: "calm-water-record" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲自确认原水面是否平静", "0行动 · 1秒")] }), "calm-water-record");
    value.life.playerLocation = "VANTAGE";
    const before = structuredClone(value), { onCommand, container } = panel(value);
    const record = screen.getByRole("region", { name: "有限水面片段与原证词" });
    for (const text of ["尚未现场确认", "尚无已取得的片段", "当前假说：尚未提出", "塞尔玛未问、奥林未问", "尚未亲自读取", "假说不是事实"]) expect(record.textContent).toContain(text);
    for (const text of ["蓝布", "一声铃", "奥林为靠船", "奥林实际移动"]) expect(container.textContent).not.toContain(text);
    fireEvent.click(button("亲自确认原水面是否平静")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows earned fragments and a saved hypothesis without treating them as witness evidence", () => {
    const command: SeaKingCommand = { type: "HYPOTHESIZE", caseId: "calm-water-record", hypothesis: "CURRENT" };
    const value = activate(projection({ promoted: true, actions: [action(command, "先写水流带动的假说", "0行动 · 1秒")] }), "calm-water-record", attempt({ calmChecked: true, abilityTier: "SUCCESS", fragments: ["BLUE_CLOTH", "ONE_BELL"], spiritualitySpent: 6 }));
    value.life.playerLocation = "VANTAGE";
    const before = structuredClone(value), { onCommand } = panel(value);
    const record = screen.getByRole("region", { name: "有限水面片段与原证词" });
    for (const text of ["本次实际片段：蓝布、一声铃", "片段本身不指认人物", "塞尔玛未问、奥林未问", "当前假说：尚未提出"]) expect(record.textContent).toContain(text);
    expect(record.textContent).not.toContain("已据真实证词及原签注核实");
    fireEvent.click(button("先写水流带动的假说")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps the wrong original hypothesis until actual witnesses and original record justify a correction", () => {
    const command: SeaKingCommand = { type: "READ_RECORD", caseId: "calm-water-record" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲读原交班签注", "0行动 · 1秒"),
      action({ type: "VERIFY", caseId: "calm-water-record" }, "核实本次假说", "0行动", { enabled: false, reason: "须亲读原签注后再核实假说。" })] }), "calm-water-record", attempt({ calmChecked: true, hypothesis: "CURRENT", hypothesisHistory: ["CURRENT"], selmaAsked: true, orinAsked: true }));
    const { defaults, rerender, onCommand } = panel(value);
    let record = screen.getByRole("region", { name: "有限水面片段与原证词" });
    expect(record.textContent).toContain("当前假说：水流带动"); expect(record.textContent).toContain("塞尔玛已问、奥林已问"); expect(record.textContent).toContain("尚未亲自读取");
    expect(button("核实本次假说").disabled).toBe(true);
    fireEvent.click(button("亲读原交班签注")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const saved = structuredClone(value), correction: SeaKingCommand = { type: "HYPOTHESIZE", caseId: "calm-water-record", hypothesis: "HAND_MOVED" };
    saved.life.currentAttempt!.ownerEvidenceRead = true; saved.life.handoverRecord.location = "PLAYER";
    saved.life.cases[2]!.observations = ["两位原人当面确认及同一原签注证明：奥林实际移动原桶以便靠船。"];
    saved.actions = [action(correction, "据真实签注修正原假说", "0行动 · 原假说保留")];
    rerender(<SeaKingPanel {...defaults} value={saved} />);
    record = screen.getByRole("region", { name: "有限水面片段与原证词" });
    expect(record.textContent).toContain("当前假说：水流带动"); expect(record.textContent).toContain("已亲自读取");
    expect(screen.getByRole("region", { name: "本案已取得的原观察" }).textContent).toContain("奥林实际移动原桶");
    fireEvent.click(button("据真实签注修正原假说")); expect(onCommand).toHaveBeenLastCalledWith(correction); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("retains corrected hypotheses and the unmoved original barrel while the original record awaits return", () => {
    const command: SeaKingCommand = { type: "RETURN_ITEMS", caseId: "calm-water-record" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手交回同一原签注与海图", "0行动 · 原物真实归还")] }), "calm-water-record", attempt({ calmChecked: true, hypothesis: "HAND_MOVED", hypothesisHistory: ["CURRENT", "HAND_MOVED"],
      selmaAsked: true, orinAsked: true, ownerEvidenceRead: true, verified: true, abilityTier: "FAILURE", spiritualitySpent: 6 }));
    value.life.handoverRecord.location = "PLAYER"; value.life.chart.location = "PLAYER"; value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const record = screen.getByRole("region", { name: "有限水面片段与原证词" });
    for (const text of ["水流带动 → 有人移动", "最初假说仍保留", "SK3-HANDOVER 在本人手中", "SK3-BARREL", "当前在旁泊位", "不会因看过往移动", "尚无已取得的片段"]) expect(record.textContent).toContain(text);
    expect(button("亲手交回同一原签注与海图").disabled).toBe(false);
    fireEvent.click(button("亲手交回同一原签注与海图")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps completed observations and original returns after scene closure without reopening the case", async () => {
    const value = projection({ promoted: true, actions: [] }), saved = attempt({ closed: true, result: "ORDINARY", calmChecked: true, hypothesis: "HAND_MOVED", hypothesisHistory: ["CURRENT", "HAND_MOVED"],
      selmaAsked: true, orinAsked: true, ownerEvidenceRead: true, recordReturned: true, verified: true, inspected: true, itemsReturned: true });
    const entry = value.life.cases[2]!; entry.status = "RESOLVED"; entry.attempts = [saved]; entry.returned = true; entry.closes = 1; entry.result = "原签注与海图已亲手归还，原浮桶保留在旁泊位。";
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择海王生活情境" }), "calm-water-record");
    expect(screen.getByRole("region", { name: "有限水面片段与原证词" }).textContent).toContain("原签注已亲手归还");
    expect(fold("三项实践的原观察与结果").open).toBe(false); await open("三项实践的原观察与结果");
    expect(screen.getByRole("region", { name: "海王生活记录" }).textContent).toContain("本次已收束");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("does not repeat a zero-action original return through pending or failed persistence", () => {
    const command: SeaKingCommand = { type: "ROW_RETURN", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "普通划回同一原艇", "0行动 · 60秒 · 精力12")] }), "remote-dinghy", attempt({ rowedOut: true }));
    value.life.dinghy.location = "MARK"; value.life.dinghy.occupant = "SK3-ORIN"; value.life.orin.location = "DINGHY";
    const { defaults, onCommand, rerender } = panel(value);
    fireEvent.click(button("普通划回同一原艇")); fireEvent.click(button("普通划回同一原艇"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(button("普通划回同一原艇").disabled).toBe(true);
    rerender(<SeaKingPanel {...defaults} error={{ message: "原艇返程尚未写入", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("当前仍显示上次已保存的记录");
    expect(screen.getByRole("region", { name: "同一原艇与实际划手" }).textContent).toContain("在六十米外原浮标处");
    expect(button("关闭海王页面").disabled).toBe(true); fireEvent.click(button("普通划回同一原艇")); expect(onCommand).toHaveBeenCalledOnce();
    rerender(<SeaKingPanel {...defaults} value={structuredClone(value)} />);
    expect(button("普通划回同一原艇").disabled).toBe(true);
    const saved = structuredClone(value); saved.life.dinghy.location = "PIER"; saved.life.currentAttempt!.returnedBy = "OARS";
    saved.life.orin.energy = 76; saved.actions = [action({ type: "TIE_BOAT", caseId: "remote-dinghy" }, "系回同一原缆", "0行动 · 2秒")];
    rerender(<SeaKingPanel {...defaults} value={saved} />);
    expect(button("系回同一原缆").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "同一原艇与实际划手" }).textContent).toContain("本次原人已普通划返");
    expect(onCommand).toHaveBeenCalledOnce();
  });

  it("folds unavailable later substeps while keeping the actual next action and its costs in front", async () => {
    const command: SeaKingCommand = { type: "CONSENT_OWNER", caseId: "remote-dinghy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面取得本次物主许可", "0行动 · 2秒"),
      action({ type: "ROW_OUT", caseId: "remote-dinghy" }, "等待条件齐备后由原人划出", "0行动 · 60秒 · 精力12", { enabled: false, reason: "先确认本次许可、原图与边界。" })] }), "remote-dinghy");
    const { onCommand } = panel(value), later = button("等待条件齐备后由原人划出"), unavailable = fold("其它步骤与未满足条件");
    expect(unavailable.open).toBe(false); expect(later.closest("details")).toBe(unavailable); expect(later.disabled).toBe(true);
    expect(button("当面取得本次物主许可").closest("details")).toBeNull();
    expect(screen.getByRole("region", { name: "海王当前目标" }).textContent).toContain("下一步：当面取得本次物主许可");
    await open("其它步骤与未满足条件"); expect(unavailable.open).toBe(true); expect(unavailable.textContent).toContain("先确认本次许可、原图与边界");
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("当面取得本次物主许可")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
  });
});


describe("SeaKingPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [] }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["序列3海王已核实；当前只开放有限海域实践G。下一序列2天灾尚未开放。", "序列3海王当前只开放有限海域实践。下一序列2天灾仍须另行晋升，本页不直接授予其能力。"],
      ["原文已核实灾难主祭4 → 海王3 → 天灾2；下一阶天灾本阶段不开放。完整配方、材料用量、调配顺序及海王晋升仪式仍未核实。", "灾难主祭4 → 海王3 → 天灾2；下一阶天灾仍须另行晋升，本页不直接授予其能力。当前渠道只提供独立成品，不提供完整配方、材料用量或调配顺序；晋升仍须完成专业准备。"],
      ["。独立成品渠道、专业支持与以上全部数值均为本作G，不冒充原著完整配方或晋升仪式。", "。独立成品渠道、专业支持与以上全部数值以当前说明为准；服药前仍须完成本次专业准备。"],
      ["原文第三部58章直述序列3海王，第四部83章给出4→3→2称号链。第三部229章支持在自己掌控海域中远距离施加风力；另有排开遗迹海水、带空气同行与平静水面看有限过往的案例，仍需实际调查。", "序列3海王可在自己掌控的海域中远距离施加风力；排开遗迹海水、带空气同行与通过平静水面查看有限过往，均须遵守当前范围并实际调查。"],
      ["原文未给出本作距离、水量、消耗或初晋强度。96米边界、20水量单位及三项故事均为G限界，不直接照搬资深考特曼的强度，不授予任意历史或全海眼线。", "当前范围限于96米边界、20水量单位及三项故事，距离、水量、消耗与初晋强度以当前说明为准。不以资深海王的表现提高本阶强度，不授予任意历史或全海眼线。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(paragraphs.some(text => text.startsWith(`当次准备：${value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}`))).toBe(true);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
