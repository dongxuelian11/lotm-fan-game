/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightScholarPanel, type InsightScholarPanelProps } from "../../src/renderer/InsightScholarPanel";
import type { InsightScholarAction, InsightScholarCommand, InsightScholarProjection } from "../../src/domain/insight-scholar/types";
import { INSIGHT_SCHOLAR_CONSUMPTION_RISK } from "../../src/domain/insight-scholar/content";

type Attempt = NonNullable<InsightScholarProjection["life"]["currentAttempt"]>;
type CaseId = InsightScholarProjection["life"]["cases"][number]["id"];
function action(command: InsightScholarCommand, label: string, cost = "0行动", extra: Partial<InsightScholarAction> = {}): InsightScholarAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取洞悉者专业指导", "1行动 · 500便士");
const consume = (id = "insight-scholar-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 94, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0, playerTravelMetres: 0,
    spiritualitySpent: 0, abilityTier: null, ownerConsent: "UNASKED", ownerConsentWeek: null, recorderConsent: "UNASKED", recorderConsentWeek: null,
    readBoth: false, compared: false, manualCompared: false, hypothesis: null, hypothesisHistory: [], ownerEvidenceRead: false, verified: false, papersReturned: false,
    recordRead: false, firstDemoSeen: false, secondDemoSeen: false, demonstrationsPerformed: 0, prediction: null, observedResult: false, revised: false, boxReturned: false,
    oldRouteRead: false, scouted: false, route: null, routeHistory: [], shortBlocked: false, parcelTaken: false, parcelReturned: false, inspected: false, refused: false, ...extra };
}
function life(): InsightScholarProjection["life"] {
  return { title: "有限证据关联与方法辨析（G）", story: "三项原创G实践", environment: "入口到原桌2米、原校验台3米、转角2米；转角旁路到库房6米。",
    activeCase: null, inside: false, insideCase: false, reflected: false, clockSeconds: 0, playerLocation: "EXIT", playerTravelMetres: 0,
    fenna: { id: "IS3-FENNA", name: "芬娜", age: 42, alive: true, willing: true, location: "EXIT" },
    osric: { id: "IS3-OSRIC", name: "奥斯里克", age: 51, alive: true, willing: true, present: true, location: "BENCH" },
    original: { id: "IS3-ORIGINAL", owner: "IS3-FENNA", location: "DESK" },
    copy: { id: "IS3-COPY", owner: "IS3-FENNA", location: "DESK" },
    box: { id: "IS3-BOX", owner: "IS3-FENNA", location: "OWNER", charges: 2, selector: "LIGHT", output: "DARK", demonstrations: 0 },
    routeRecord: { id: "IS3-ROUTE", owner: "IS3-FENNA", location: "DESK" },
    barrier: { id: "IS3-BARRIER", location: "JUNCTION", state: "CLOSED" },
    parcel: { id: "IS3-PARCEL", owner: "IS3-FENNA", location: "STORE" }, currentAttempt: null, actions: [],
    cases: ([
      { id: "copy-discrepancy", title: "两份原纸的差异", story: "先亲自读取两张原纸，再核对原主人提供的真实凭据。" },
      { id: "known-method", title: "同一原匣的两次展示", story: "先读记录和第一次展示，再预测、观察并复核。" },
      { id: "revised-route", title: "旧记录与当前路线", story: "亲自到转角侦察，再选择实际取回原包的路线。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): InsightScholarProjection["encounter"] {
  return { title: "原庭与独立的阿尔顿", story: "2米净空原庭，实际普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    enemy: { id: "IS3-ALTON", name: "阿尔顿", age: 47, source: "ORIGINAL_OPEN_COURT_ADULT", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "IS3-ALTON-CLUB", weaponLocation: "HAND", powerUses: { FLASH: 1, WARD: 2, FOCUS: 1 }, seenPowers: ["FLASH", "WARD"] },
    actions: [], facts: ["实际普通出口开放，无追逐。", "本轮专注可以抵抗有限压力。"] };
}
/** Public renderer fixture only; it is not domain eligibility or a natural gameplay replay. */
function projection(extra: Partial<InsightScholarProjection> = {}): InsightScholarProjection {
  return { title: "洞悉者·阅读者序列3候选（G扩展）", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "证据关联与方法辨析均为候选G。", supplies: "三瓶独立成品各6200便士，或各五次劳务后800便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `insight-scholar-potion-${n}`, title: `洞悉者第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签IS3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `insight-scholar-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_RECORDS", title: "原记录来源核对", completedWeek: 82 },
      { taskId: "COMPARE_METHODS", title: "比较已见方法", completedWeek: 83 }, { taskId: "PLAN_EXIT", title: "实际普通出口核对", completedWeek: 83 }],
    preparedWeek: 84, abilities: [{ id: "reader.s3.evidence-link", label: "有限证据关联（G）", mastery: 8, description: "只比较已经亲自读取的有限原证据。" },
      { id: "reader.s3.method-analysis", label: "有限方法辨析（G）", mastery: 0, description: "只比较已经实际见过的方法。" }],
    acting: 0, digestion: "原预言家消化100，从第68周晋升已过12整周。", pollution: 3, risk: INSIGHT_SCHOLAR_CONSUMPTION_RISK,
    resources: { health: 70, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧哈罗德PF4-HAROLD已SURRENDERED，健康70，精神100，原棍留YARD。", "MM5-FLASH-1已耗；同一MM5-FLASH-3仍PLAYER，原MM5-KIT-3与第63周来源保留。", "诺拉、埃德温、乔纳斯原物保留；原窗销SOUND，旧页TABLE，包裹NORA，钳JONAS。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原库房、原校验台和实际普通出口。", ...extra };
}
function activate(value: InsightScholarProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<InsightScholarPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<InsightScholarPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("InsightScholarPanel finite evidence, independent preparation and real original objects", () => {
  it("leads with real readiness and resources, folding detailed rules and hiding unknown recipe materials", () => {
    const reason = "从原预言家晋升起仅11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应出现的假材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "洞悉者当前目标" }).textContent).toContain(reason);
    expect(button("听取洞悉者专业指导").disabled).toBe(true);
    expect(button("听取洞悉者专业指导").getAttribute("aria-describedby")).toContain("insight-scholar-reason-");
    const resources = screen.getByRole("region", { name: "洞悉者当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["70 / 100", "85 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不应出现的假材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "原身体、旧哈罗德与原物", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取洞悉者专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("states current limited evidence and preparation while preserving old Harold and original materials", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    expect(screen.getByRole("region", { name: "洞悉者当前目标" }).textContent).toContain("本阶段开放三项有限实践；晋升须取得独立成品并完成专业准备。");
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "洞悉者成品与配方边界" });
    for (const text of ["有限证据关联与方法辨析", "仍须依靠当前原件、原人和现场", "晋升使用独立成品，并须完成专业准备", "不提供全知真相", "任意弱点", "自动复制或新技能库", "6200", "800", "第82周", "待解释的有限片段与梦象", "12整周", "原消化100", "指导500便士", "1行动及120便士", "五次真实劳务"]) expect(boundary.textContent).toContain(text);
    await open("原身体、旧哈罗德与原物");
    const history = screen.getByRole("region", { name: "洞悉者继承记录" });
    for (const text of ["女性", "PF4-HAROLD已SURRENDERED", "健康70", "原棍留YARD", "MM5-FLASH-1已耗", "MM5-FLASH-3仍PLAYER", "MM5-KIT-3", "窗销SOUND", "包裹NORA", "钳JONAS"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and emits its exact original labour intent without mutating it", async () => {
    const commands: InsightScholarCommand[] = [{ type: "POTION_WORK", bottleId: "insight-scholar-potion-1" }, { type: "POTION_WORK", bottleId: "insight-scholar-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }), "insight-scholar-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews only one original bottle, risk and actual resources, then cancels with Escape and restores focus", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "洞悉者原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "洞悉者第1独立原瓶" }));
    for (const text of ["insight-scholar-potion-1", "IS3-SEAL-1", "71%", "第84周", "成功或失败", "性别不改变", "当前灵性不补满", "普通死亡", "0行动"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("IS3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "洞悉者原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits one confirmed intent and keeps it locked through failed save until a changed committed projection arrives", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<InsightScholarPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "洞悉者原瓶服用确认" })).toBeTruthy();
    rerender(<InsightScholarPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = [];
    saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<InsightScholarPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "洞悉者原瓶服用确认" })).toBeNull();
    expect(button("关闭洞悉者页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });


  it("keeps a failed original bottle spent and resumes real labour on another bottle without changing current resources", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, defaults, rerender } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶"));
    const saved = structuredClone(value); saved.preparedWeek = null;
    saved.bottles[0]!.status = "原瓶已耗尽 · 晋升失败";
    saved.bottles[1]!.status = "仍在原供应人处 · 劳务0/5";
    saved.resources = { ...saved.resources!, health: 55, mind: 60 };
    const work: InsightScholarCommand = { type: "POTION_WORK", bottleId: "insight-scholar-potion-2" };
    saved.actions = [action(work, "为第二独立原瓶实际劳务", "1行动")];
    rerender(<InsightScholarPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "洞悉者原瓶服用确认" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }) as HTMLSelectElement).value).toBe("insight-scholar-potion-2");
    expect(screen.getByRole("region", { name: "洞悉者当前资源" }).textContent).toContain("55 / 100");
    await open("独立成品与晋升准备");
    expect(screen.getByRole("region", { name: "洞悉者成品与配方边界" }).textContent).toContain("原瓶已耗尽 · 晋升失败");
    const before = structuredClone(saved); fireEvent.click(button("为第二独立原瓶实际劳务"));
    expect(onCommand).toHaveBeenLastCalledWith(work); expect(onCommand).toHaveBeenCalledTimes(2); expect(saved).toEqual(before);
  });

  it("invalidates an unsubmitted review when the original cost or resource facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    for (const changed of [{ ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, resources: { ...value.resources!, spirituality: 41 } }]) {
      rerender(<InsightScholarPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<InsightScholarPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "洞悉者原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative blocker", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<InsightScholarPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原现场尚未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true);
    expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("insight-scholar-confirm-reason");
    expect(screen.getByRole("region", { name: "洞悉者原瓶服用确认" }).textContent).toContain("原现场尚未收束");
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("locks commands, selectors and dismissal during pending recovery: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("听取洞悉者专业指导").disabled).toBe(true); expect(button("关闭洞悉者页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("听取洞悉者专业指导")); fireEvent.click(button("关闭洞悉者页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });

  it("selects a case without starting it and sends only that case's public intent", async () => {
    const commands: InsightScholarCommand[] = [{ type: "OBSERVE", caseId: "copy-discrepancy" }, { type: "OBSERVE", caseId: "known-method" }, { type: "OBSERVE", caseId: "revised-route" }];
    const value = projection({ promoted: true, actions: commands.map((command, i) => action(command, `观察第${i + 1}案`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择洞悉者生活情境" }), "known-method");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察第1案/ })).toBeNull();
    const box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    expect(box.textContent).toContain("尚无本次已保存许可"); expect(box.textContent).toContain("原匣剩余储能 2 / 2");
    expect(box.textContent).not.toContain("已实际观察结果");
    fireEvent.click(button("观察第2案")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it("keeps a successful comparison as a hint and sends the player's unproved hypothesis unchanged", () => {
    const command: InsightScholarCommand = { type: "HYPOTHESIZE", caseId: "copy-discrepancy", hypothesis: "MISSING_DELIVERY" };
    const value = activate(projection({ promoted: true, actions: [action(command, "先猜交付缺失")] }), "copy-discrepancy", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 94, readBoth: true, compared: true, abilityTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.original.location = "PLAYER"; value.life.copy.location = "PLAYER"; value.life.playerLocation = "DESK";
    value.life.cases[0]!.observations = ["原纸与抄件有一行数量不同；这还不能确定差异原因。"];
    const before = structuredClone(value), { onCommand } = panel(value);
    const originals = screen.getByRole("region", { name: "两张原纸与待核假说" });
    for (const text of ["IS3-ORIGINAL", "IS3-COPY", "IS3-FENNA", "当前在本人手中", "已亲手取读", "当前假说：尚未提出", "尚未当面取得原交接签注", "不判定谁说谎"]) expect(originals.textContent).toContain(text);
    expect(originals.textContent).not.toContain("已据原件与真实签注完成核实");
    expect(screen.getByRole("region", { name: "本案已取得的原观察" }).textContent).toContain("还不能确定差异原因");
    expect((screen.getByRole("combobox", { name: "选择洞悉者生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("先猜交付缺失")); fireEvent.click(button("先猜交付缺失"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("preserves an incorrect hypothesis and lets real new owner evidence support correction without rerolling", () => {
    const command: InsightScholarCommand = { type: "HYPOTHESIZE", caseId: "copy-discrepancy", hypothesis: "COPY_ERROR" };
    const value = activate(projection({ promoted: true, actions: [action(command, "据原签注修正为抄件漏记")] }), "copy-discrepancy", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 94, readBoth: true, compared: true, abilityTier: "FAILURE", spiritualitySpent: 6,
      manualCompared: true, hypothesis: "MISSING_DELIVERY", hypothesisHistory: ["MISSING_DELIVERY"], ownerEvidenceRead: true, elapsedSeconds: 19, playerTravelMetres: 4 }));
    value.life.cases[0]!.observations = ["芬娜当面出示原交接签注：交付完整，抄件漏记数量。"];
    const before = structuredClone(value), { onCommand } = panel(value);
    const originals = screen.getByRole("region", { name: "两张原纸与待核假说" });
    expect(originals.textContent).toContain("当前假说：交付缺失"); expect(originals.textContent).toContain("已当面读取原主人的交接签注");
    expect(screen.getByRole("region", { name: "本案已取得的原观察" }).textContent).toContain("交付完整，抄件漏记数量");
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "洞悉者本次尝试与代价" });
    for (const text of ["唯一能力判定：失败", "不能重骰", "已付灵性 6", "实际经过 19 秒", "普通行走 4 米"]) expect(cost.textContent).toContain(text);
    fireEvent.click(button("据原签注修正为抄件漏记")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps the original papers borrowed at zero resources until their actual return commits", () => {
    const command: InsightScholarCommand = { type: "RETURN_PAPERS", caseId: "copy-discrepancy" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手归还两张原纸")] }), "copy-discrepancy", attempt({ readBoth: true, compared: true, ownerEvidenceRead: true, verified: true,
      hypothesis: "COPY_ERROR", hypothesisHistory: ["MISSING_DELIVERY", "COPY_ERROR"], abilityTier: "FAILURE", spiritualitySpent: 6 }));
    value.life.original.location = "PLAYER"; value.life.copy.location = "PLAYER"; value.life.playerLocation = "DESK";
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0, mind: 0 };
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const originals = screen.getByRole("region", { name: "两张原纸与待核假说" });
    expect(originals.textContent).toContain("交付缺失 → 抄件漏记"); expect(originals.textContent).toContain("尚无归还完成记录");
    expect(button("亲手归还两张原纸").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "洞悉者停止与普通收束" }).contains(button("亲手归还两张原纸"))).toBe(true);
    fireEvent.click(button("关闭洞悉者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("亲手归还两张原纸")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(originals.textContent).toContain("当前在本人手中"); expect(value).toEqual(before);
  });

  it("requires both original people and the actual record before showing the first demonstration", () => {
    const command: InsightScholarCommand = { type: "CONSENT_RECORDER", caseId: "known-method" };
    const value = activate(projection({ promoted: true, actions: [action(command, "当面问奥斯里克"), action({ type: "DEMONSTRATE_FIRST", caseId: "known-method" }, "原人实际第一次展示", "0行动 · 耗原匣一格", { enabled: false, reason: "须记录员本次同意并亲自读原记录。" })] }), "known-method", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 94 }));
    const before = structuredClone(value), { onCommand } = panel(value);
    const box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    for (const text of ["奥斯里克", "51岁", "本人当前在场", "记录员本次许可：本次尚未当面询问", "尚未亲自读取原操作记录", "IS3-BOX", "IS3-FENNA", "原匣剩余储能 2 / 2", "尚未亲眼观察第一次实际展示"]) expect(box.textContent).toContain(text);
    expect(box.textContent).not.toContain("已实际观察结果"); expect(button("原人实际第一次展示").disabled).toBe(true);
    fireEvent.click(button("当面问奥斯里克")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows one spent original charge after the first demonstration and lets the player predict", () => {
    const command: InsightScholarCommand = { type: "PREDICT", caseId: "known-method", prediction: "LIT" };
    const value = activate(projection({ promoted: true, actions: [action(command, "预测第二次仍亮灯")] }), "known-method", attempt({ ownerConsent: "GRANTED", recorderConsent: "GRANTED", recordRead: true,
      firstDemoSeen: true, demonstrationsPerformed: 1, abilityTier: "SUCCESS", spiritualitySpent: 5 }));
    value.life.box.location = "BENCH"; value.life.box.charges = 1; value.life.box.output = "LIT"; value.life.box.demonstrations = 1;
    const before = structuredClone(value), { onCommand } = panel(value);
    const box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    for (const text of ["原匣剩余储能 1 / 2", "累计实际展示 1 次", "第一次操作亮灯", "已保存预测：尚未提出", "第二次实际展示尚未发生"]) expect(box.textContent).toContain(text);
    expect(box.textContent).not.toContain("已实际观察结果");
    fireEvent.click(button("预测第二次仍亮灯")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps a wrong prediction after the second demonstration and only reveals the checked result after observing", () => {
    const command: InsightScholarCommand = { type: "OBSERVE_RESULT", caseId: "known-method" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲眼核对第二次结果")] }), "known-method", attempt({ firstDemoSeen: true, secondDemoSeen: true, demonstrationsPerformed: 2,
      prediction: "LIT", abilityTier: "FAILURE", spiritualitySpent: 5 }));
    value.life.box.location = "BENCH"; value.life.box.charges = 0; value.life.box.selector = "DARK"; value.life.box.output = "DARK"; value.life.box.demonstrations = 2;
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    let box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    for (const text of ["原匣剩余储能 0 / 2", "累计实际展示 2 次", "已保存预测：亮灯", "完成第二次展示", "尚未完成结果观察"]) expect(box.textContent).toContain(text);
    expect(box.textContent).not.toContain("已实际观察结果：不亮");
    fireEvent.click(button("亲眼核对第二次结果")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
    const saved = structuredClone(value); saved.life.currentAttempt!.observedResult = true;
    saved.actions = [action({ type: "REVISE", caseId: "known-method" }, "据实际不亮复核预测")];
    rerender(<InsightScholarPanel {...defaults} value={saved} />);
    box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    expect(box.textContent).toContain("已实际观察结果：不亮"); expect(box.textContent).toContain("已保存预测：亮灯");
    expect(box.textContent).toContain("尚未完成预测复核"); expect(button("据实际不亮复核预测").disabled).toBe(false);
  });

  it("returns the same empty original box without refilling it or erasing the original prediction", () => {
    const command: InsightScholarCommand = { type: "RETURN_BOX", caseId: "known-method" };
    const value = activate(projection({ promoted: true, actions: [action(command, "将同一空匣还给芬娜")] }), "known-method", attempt({ firstDemoSeen: true, secondDemoSeen: true, demonstrationsPerformed: 2,
      prediction: "LIT", observedResult: true, revised: true, abilityTier: "FAILURE", spiritualitySpent: 5 }));
    value.life.box.location = "BENCH"; value.life.box.charges = 0; value.life.box.output = "DARK"; value.life.box.demonstrations = 2;
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    for (const text of ["IS3-BOX", "原匣剩余储能 0 / 2", "已保存预测：亮灯", "已实际观察结果：不亮", "最初预测仍保留", "尚无归还完成记录", "不免费充能"]) expect(box.textContent).toContain(text);
    expect(button("将同一空匣还给芬娜").disabled).toBe(false);
    fireEvent.click(button("将同一空匣还给芬娜")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows the recorder's actual refusal and a free original-object return rather than another demonstration", () => {
    const command: InsightScholarCommand = { type: "RETURN_BOX", caseId: "known-method" };
    const value = activate(projection({ promoted: true, actions: [action(command, "普通归还原匣"), action({ type: "DEMONSTRATE_FIRST", caseId: "known-method" }, "再次要求展示", "耗原匣一格", { enabled: false, reason: "原人已拒绝本次用途。" })] }), "known-method", attempt({ recorderConsent: "DECLINED" }));
    value.life.osric.willing = false; value.life.box.location = "BENCH";
    const before = structuredClone(value), { onCommand } = panel(value);
    const box = screen.getByRole("region", { name: "同一原示范匣与预测复核" });
    expect(box.textContent).toContain("本人已拒绝继续展示"); expect(box.textContent).toContain("记录员本次许可：已拒绝本次用途");
    expect(button("再次要求展示").disabled).toBe(true); expect(button("普通归还原匣").disabled).toBe(false);
    fireEvent.click(button("普通归还原匣")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("does not present current barrier knowledge before the player actually scouts the original junction", () => {
    const command: InsightScholarCommand = { type: "SCOUT", caseId: "revised-route" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲自走两米到转角观察")] }), "revised-route", attempt({ oldRouteRead: true }));
    const before = structuredClone(value), { onCommand } = panel(value);
    const route = screen.getByRole("region", { name: "旧记录与当前原路" });
    for (const text of ["IS3-ROUTE", "已亲自读取旧路线记录", "尚未亲自侦察转角", "旧记录不能保证当前可通行"]) expect(route.textContent).toContain(text);
    expect(route.textContent).not.toContain("IS3-BARRIER"); expect(route.textContent).not.toContain("已亲眼查看");
    fireEvent.click(button("亲自走两米到转角观察")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps the blocked short route at the real junction and lets the player choose the actual six-metre bypass", () => {
    const command: InsightScholarCommand = { type: "CHOOSE_ROUTE", caseId: "revised-route", route: "SIDE" };
    const value = activate(projection({ promoted: true, actions: [action(command, "改走六米普通旁路")] }), "revised-route", attempt({ oldRouteRead: true, scouted: true, route: "SHORT", routeHistory: ["SHORT"], shortBlocked: true,
      abilityTier: "FAILURE", spiritualitySpent: 6, playerTravelMetres: 2, elapsedSeconds: 15 }));
    value.life.playerLocation = "JUNCTION"; value.life.playerTravelMetres = 2;
    const before = structuredClone(value), { onCommand } = panel(value);
    const route = screen.getByRole("region", { name: "旧记录与当前原路" });
    for (const text of ["IS3-BARRIER：仍关闭", "本人仍在转角", "可改走普通旁路", "IS3-PARCEL", "当前在原库房", "不遥知原包内容"]) expect(route.textContent).toContain(text);
    fireEvent.click(button("改走六米普通旁路")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(value).toEqual(before); expect(value.life.parcel.location).toBe("STORE");
  });

  it("requires a real return with the same parcel even with no actions or spirituality and does not teleport on dismissal", () => {
    const command: InsightScholarCommand = { type: "RETURN_PLAYER", caseId: "revised-route" };
    const value = activate(projection({ promoted: true, actions: [action(command, "携同一原包沿旁路回入口")] }), "revised-route", attempt({ oldRouteRead: true, scouted: true, route: "SIDE", routeHistory: ["SHORT", "SIDE"], shortBlocked: true,
      parcelTaken: true, abilityTier: "FAILURE", spiritualitySpent: 6, playerTravelMetres: 8, elapsedSeconds: 23 }));
    value.life.playerLocation = "STORE"; value.life.playerTravelMetres = 8; value.life.parcel.location = "PLAYER";
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const route = screen.getByRole("region", { name: "旧记录与当前原路" });
    for (const text of ["旧记录中的短廊 → 六米普通旁路", "当前在本人手中", "已亲手取得同一原包", "原包尚无交还完成记录", "实际走回6米旁路和2米入口"]) expect(route.textContent).toContain(text);
    expect(route.textContent).not.toContain("本人仍在转角"); expect(button("携同一原包沿旁路回入口").disabled).toBe(false);
    fireEvent.click(button("关闭洞悉者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("携同一原包沿旁路回入口")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("retains a completed case's actual evidence and original-object return after the active scene closes", () => {
    const value = projection({ promoted: true, actions: [] });
    const saved = attempt({ closed: true, result: "ORDINARY", oldRouteRead: true, scouted: true, route: "SIDE", routeHistory: ["SIDE"], parcelTaken: true, parcelReturned: true, inspected: true, playerTravelMetres: 16 });
    const entry = value.life.cases[2]!; entry.status = "RESOLVED"; entry.attempts = [saved]; entry.result = "同一原包已沿普通旁路取回并交还。";
    value.life.parcel.location = "OWNER";
    panel(value);
    fireEvent.change(screen.getByRole("combobox", { name: "选择洞悉者生活情境" }), { target: { value: "revised-route" } });
    const route = screen.getByRole("region", { name: "旧记录与当前原路" });
    expect(route.textContent).toContain("已亲手交回原主人"); expect(route.textContent).toContain("IS3-BARRIER：仍关闭");
    expect(route.textContent).not.toContain("尚未亲自侦察转角");
  });

  it("shows the independent injured Alton, original weapon and ordinary exit without rewriting old Harold", async () => {
    const command: InsightScholarCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(command, "沿原出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY";
    const before = structuredClone(value), { onCommand } = panel(value);
    const original = screen.getByRole("region", { name: "洞悉者原人遭遇" });
    for (const text of ["阿尔顿", "47岁", "IS3-ALTON", "健康 90", "精神 100", "独立灵性 103", "IS3-ALTON-CLUB", "仍在原人手中", "旧哈罗德分别保存", "普通出口开放", "闪光（FLASH）", "护术（WARD）"]) expect(original.textContent).toContain(text);
    expect(fold("本场范围与战斗代价").open).toBe(false); await open("本场范围与战斗代价");
    for (const text of ["本场已亲眼见到", "不预读下一动作", "不自动复制能力", "原件", "普通动作回退"]) expect(original.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前洞悉者生活情境" })).toBeNull();
    fireEvent.click(button("沿原出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("folds old crafting away from the current case and forwards its exact original intent", async () => {
    const command: InsightScholarCommand = { type: "MAKE_INHERITED_FLASH" };
    const value = projection({ promoted: true, actions: [action(command, "按旧规则制作微光片", "1行动 · 原材料与旧实际成本"),
      action({ type: "OBSERVE", caseId: "copy-discrepancy" }, "观察两张原纸", "1行动")] }), before = structuredClone(value), { onCommand } = panel(value);
    const inheritedFold = fold("原身体、旧哈罗德与原物"), crafting = button("按旧规则制作微光片");
    // JSDOM omits the native details shadow-tree styles, so role queries alone do not model its closed contents.
    expect(inheritedFold.open).toBe(false); expect(crafting.closest("details")).toBe(inheritedFold);
    expect(screen.getByRole("region", { name: "洞悉者当前行动" }).contains(crafting)).toBe(false);
    const currentGoal = screen.getByRole("region", { name: "洞悉者当前目标" });
    expect(currentGoal.textContent).toContain("下一步：观察两张原纸"); expect(currentGoal.textContent).not.toContain("按旧规则制作微光片");
    await open("原身体、旧哈罗德与原物");
    expect(inheritedFold.open).toBe(true); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("按旧规则制作微光片")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });
});
