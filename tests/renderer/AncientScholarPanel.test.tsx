/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AncientScholarPanel, type AncientScholarPanelProps } from "../../src/renderer/AncientScholarPanel";
import type { AncientScholarAction, AncientScholarCommand, AncientScholarProjection } from "../../src/domain/ancient-scholar/types";

const action = (command: AncientScholarCommand, label: string, cost = "0行动", extra: Partial<AncientScholarAction> = {}): AncientScholarAction => ({
  id: command.type, label, cost, enabled: true, reason: null, command, ...extra,
});
const pay = () => action({ type: "PAY_FACILITY" }, "支付本次静封维护余款", "0行动 · 实付120便士");
const enter = () => action({ type: "ENTER_SECLUSION", confirmed: true }, "亲自封闭原室", "不可逆隔绝 · 完整300年");
const consume = (bottleId = "AS3-BOTTLE-1") => action({ type: "CONSUME", bottleId, confirmed: true }, "服用登记原瓶", "0行动 · 消耗这一原瓶");

/** Renderer-only public fixture. This is not a natural run or evidence of qualification. */
function projection(extra: Partial<AncientScholarProjection> = {}): AncientScholarProjection {
  return {
    title: "古代学者3 · 三百年隔绝", discovered: true, formulaKnown: true, promoted: false,
    formula: [{ name: "福根之犬的眼睛", quantity: 1, unit: "对" }, { name: "大量真实古代历史记录", quantity: null, unit: "核验卷", note: "未知余项不冒称完整。" }],
    story: "已核原著至少300年完全脱离现实要求，静封设施及后世故事为原创G。",
    supplies: "本次三份独立批次，补货须真实下一周，不能当周无限原瓶。",
    bottles: [{ id: "AS3-BOTTLE-1", title: "第一独立原瓶", source: "原批AS3-BATCH-1 · 核验副本COPY-1", status: "已登记，尚未服用", chance: 72, command: { type: "CONSUME", bottleId: "AS3-BOTTLE-1", confirmed: true } }],
    abilities: [
      { id: "diviner.s3.borrow-past", label: "借用过去的自己", mastery: 0, description: "只取真实自己的样本，维持须真实当下灵性。" },
      { id: "diviner.s3.historical-projection", label: "历史影像", mastery: 0, description: "初学容量1，普通物最多30秒G，原物不变。" },
      { id: "diviner.s3.history-shelter", label: "历史藏身", mastery: 0, description: "同一身体藏入亲历片段，必须回原处。" },
    ],
    acting: 0, digestion: "尚未开始本阶实践", pollution: 0,
    risk: "失败实耗所选原瓶并留下伤害与排异；指导保护仅本次排异保底1。室内付费休养尚余3次，每次12便士，不回灵性。普通战斗死亡不能复活。",
    eraClosed: false, locked: false, insideIsolation: false, insideCase: false,
    environment: "当前只有原室准备，未给历史召唤库。",
    ritual: {
      title: "三百年完全隔绝", phase: "PREPARING", eraClosed: false, locked: false, insideIsolation: false, location: "OUTSIDE",
      summary: "已亲手核验三卷原史料、原容器与本地机械钟，尚未入舱。",
      boundary: "原件AS3-STASIS-1固定在AS3-VAULT；维持同一活体与已登记原瓶是本作G，不治疗、不回灵性、无外界通讯。",
      facility: "AS3-STASIS-1 · 同一静封钟 · 封条SEAL-1 · 三项不同检查已完成。",
      body: "TEST:body · 当前健康90/精神80/灵性75 · 原伤保留。",
      dates: ["当前实际日期1352年6月28日", "本次尚未开始连续隔绝，0年"],
      consequences: ["旧职业和旧约定在入舱后结束，不补发工资。", "玛拉46岁，出发38年后84岁故去。", "未登记室外耗材会失效。"],
      records: [{ id: "AS3-RECORD-145", title: "145年前原航运合卷", source: "原押印与独立接收目录", status: "本次实际取得并核验", verification: "COPY-1保留实际核验结果，原卷已入登记。" }],
      people: ["玛拉·森 AS3-MARA，实际在场46岁。", "普通旧人不会在300年后继续原现场接单。"],
      objects: ["AS3-BOTTLE-1同一原瓶已登记。", "BR4-TAG-1原签与BR4-CARRIER-1原携笼保留。"],
      history: ["原鼠完整转化失败后活着放生，旧多恩真实死亡，旧事实不改。"],
      qualification: "尚未连续满300年，不能服药。", ordinaryLife: "旧时代尚未关闭；未入舱可继续留在序列4。",
    },
    life: { insideCase: false, environment: "", cases: [], practice: null },
    encounter: { encounter: null },
    actions: [pay(), action({ type: "CANCEL_PREPARATION" }, "取消本次准备")],
    ...extra,
  };
}
function panel(value = projection(), props: Partial<Omit<AncientScholarPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<AncientScholarPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
async function open(summary: string) { await userEvent.click(screen.getByText(summary, { selector: "summary" })); }
afterEach(cleanup);

describe("AncientScholarPanel truthful time, originals and limited powers", () => {
  it("shows committed dates and qualification while keeping secondary records off the first screen", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("尚未连续满300年");
    for (const date of value.ritual.dates) expect(screen.getByRole("region", { name: "真实日期与连续隔绝" }).textContent).toContain(date);
    const recordsFold = screen.getByText("三卷原史料与独立核验副本", { selector: "summary" }).closest("details")!;
    // jsdom exposes descendants of native closed details to role queries; test the real disclosure state.
    expect(recordsFold.open).toBe(false);
    await open("三卷原史料与独立核验副本");
    expect(recordsFold.open).toBe(true);
    const records = screen.getByRole("region", { name: "原史料与核验" });
    for (const text of ["AS3-RECORD-145", "原押印", "COPY-1", "本次实际取得并核验"]) expect(records.textContent).toContain(text);
    expect(within(records).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("reviews the actual fee without charging and returns focus when declined", async () => {
    const { onCommand } = panel(); await userEvent.click(button("支付本次静封维护余款"));
    const review = screen.getByRole("region", { name: "静封设施付费确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "支付当前维护余款？" }));
    for (const text of ["实付120便士", "360便士", "不推进年月", "独立确认", "不会因退出退还", "留在序列4"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.click(button("暂不付费，返回准备"));
    expect(document.activeElement).toBe(button("支付本次静封维护余款")); expect(onCommand).not.toHaveBeenCalled();
  });

  it("Escape cancels only a local unsubmitted review and never exits the chamber or closes the page", async () => {
    const { onCommand, onClose } = panel(); await userEvent.click(button("支付本次静封维护余款"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "静封设施付费确认" })).toBeNull();
    expect(document.activeElement).toBe(button("支付本次静封维护余款")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits the fee once and requires an independent irreversible entry review", async () => {
    const { onCommand, defaults, rerender } = panel(); await userEvent.click(button("支付本次静封维护余款"));
    const confirm = button("确认支付，仅落实本次维护"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PAY_FACILITY" }); expect(confirm.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "静封设施付费确认" })).toBeTruthy();
    const next = projection({ actions: [enter()] });
    rerender(<AncientScholarPanel {...defaults} value={next} />);
    await userEvent.click(button("亲自封闭原室"));
    const entry = screen.getByRole("region", { name: "不可逆三百年隔绝确认" });
    for (const text of ["150年与150年", "旧时代关闭", "本地独立记录", "不与外界通信", "玛拉不会活着等你", "未满300年", "不补发三百年的工资", "仍须留在舱内核验"]) expect(entry.textContent).toContain(text);
    expect(onCommand).toHaveBeenCalledTimes(1); fireEvent.click(button("确认不可逆入舱，开始完全隔绝"));
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: "ENTER_SECLUSION", confirmed: true });
  });

  it("declines entry without cancelling preparation, moving originals or advancing time", async () => {
    const value = projection({ actions: [enter()] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button("亲自封闭原室")); await userEvent.click(button("暂不入舱，返回准备"));
    expect(document.activeElement).toBe(button("亲自封闭原室")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("invalidates review when actual costs, dates or registered original bottles change", async () => {
    const { defaults, rerender, onCommand } = panel(); await userEvent.click(button("支付本次静封维护余款"));
    const changed = projection({ actions: [{ ...pay(), cost: "实付360便士" }] });
    rerender(<AncientScholarPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "静封设施付费确认" })).toBeNull();
    await userEvent.click(button("支付本次静封维护余款"));
    const changedDate = { ...changed, ritual: { ...changed.ritual, dates: ["当前已是150年后"] } };
    rerender(<AncientScholarPanel {...defaults} value={changedDate} />);
    expect(screen.queryByRole("region", { name: "静封设施付费确认" })).toBeNull();
    await userEvent.click(button("支付本次静封维护余款"));
    rerender(<AncientScholarPanel {...defaults} value={{ ...changedDate, bottles: [] }} />);
    expect(screen.queryByRole("region", { name: "静封设施付费确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmed action readable with its current domain reason", async () => {
    const value = projection({ actions: [enter()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("亲自封闭原室"));
    rerender(<AncientScholarPanel {...defaults} value={{ ...value, actions: [{ ...enter(), enabled: false, reason: "仍有原秘偶控制与未回收灵之虫。" }] }} />);
    const confirm = button("确认不可逆入舱，开始完全隔绝");
    expect(confirm.disabled).toBe(true); expect(screen.getByRole("region", { name: "不可逆三百年隔绝确认" }).textContent).toContain("未回收灵之虫");
    expect(confirm.getAttribute("aria-describedby")).toBe("ancient-scholar-confirm-reason");
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["busy", "blocked"] as const)("locks action submission and page dismissal while %s", flag => {
    const { onCommand, onClose } = panel(projection(), { [flag]: true });
    for (const item of screen.getAllByRole("button") as HTMLButtonElement[]) { expect(item.disabled).toBe(true); fireEvent.click(item); }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("holds the original operation on save failure and directs retry to the parent save control", async () => {
    const { onCommand, onClose, defaults, rerender } = panel(); await userEvent.click(button("支付本次静封维护余款"));
    fireEvent.click(button("确认支付，仅落实本次维护"));
    rerender(<AncientScholarPanel {...defaults} error={{ message: "保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    expect(screen.getByRole("status").textContent).toContain("上次已保存的记录");
    for (const item of screen.getAllByRole("button") as HTMLButtonElement[]) expect(item.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(button("确认支付，仅落实本次维护"));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
  });

  it("requires reload for a nonretryable failure without offering a fresh mutation", () => {
    const { onCommand } = panel(projection(), { error: { message: "存档版本已变化", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(button("取消本次准备")); expect(onCommand).not.toHaveBeenCalled();
  });

  it("advances each already-agreed 150-year stage directly, once, waiting for committed state", () => {
    const value = projection({ eraClosed: true, insideIsolation: true, actions: [action({ type: "ADVANCE_FIRST_150" }, "依本地钟度过第一150年")] });
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    const first = button("依本地钟度过第一150年"); fireEvent.click(first); fireEvent.click(first);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ADVANCE_FIRST_150" }); expect(value).toEqual(before);
    expect(screen.queryByRole("region", { name: "不可逆三百年隔绝确认" })).toBeNull();
    const next = { ...value, ritual: { ...value.ritual, dates: ["当前150年后", "本地隔绝已经过150年"] }, actions: [action({ type: "ADVANCE_SECOND_150" }, "依本地钟再度过150年")] };
    rerender(<AncientScholarPanel {...defaults} value={next} />); fireEvent.click(button("依本地钟再度过150年"));
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: "ADVANCE_SECOND_150" });
  });

  it("explicitly reviews early exit without pretending 150 years qualify or refunding elapsed time", async () => {
    const value = projection({ eraClosed: true, insideIsolation: true, actions: [action({ type: "EXIT_EARLY", confirmed: true }, "提前中断本次隔绝")] });
    value.ritual.dates = ["当前150年后", "本次连续隔绝150年"]; value.ritual.qualification = "150年不足300年，没有资格。";
    const before = structuredClone(value), { onCommand } = panel(value); await userEvent.click(button("提前中断本次隔绝"));
    const review = screen.getByRole("region", { name: "提前结束隔绝确认" });
    for (const text of ["年月不会倒退", "原费用已经耗去", "新的完整300年", "150年不足300年", "留在序列4"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.click(button("继续留在封室"));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    await userEvent.click(button("提前中断本次隔绝")); fireEvent.click(button("确认提前出舱，保留已流逝年月"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXIT_EARLY", confirmed: true });
  });

  it("keeps a full 300-year save unqualified until its separate local verification action", () => {
    const value = projection({ eraClosed: true, insideIsolation: true, actions: [action({ type: "VERIFY_CONTINUITY" }, "本人核验原钟和同体记录"), { ...consume(), enabled: false, reason: "仍须本地核验连续记录。" }] });
    value.ritual.dates = ["世界已真实经过300年"]; value.ritual.qualification = "已满300年但尚未本地核验，仍不能服药。";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("尚未本地核验");
    expect(button("服用登记原瓶").disabled).toBe(true); fireEvent.click(button("本人核验原钟和同体记录"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "VERIFY_CONTINUITY" }); expect(value).toEqual(before);
  });

  it("reviews only the selected original bottle with cost, remaining protection and genuine failure risk", async () => {
    const value = projection({ eraClosed: true, insideIsolation: true, actions: [consume()] });
    value.ritual.qualification = "同一原身体、本地连续300年与原登记瓶已核验，仍在封室。";
    value.bottles.push({ ...value.bottles[0]!, id: "AS3-BOTTLE-2", title: "备用第二瓶", source: "第二原批", command: { type: "CONSUME", bottleId: "AS3-BOTTLE-2", confirmed: true } });
    const { onCommand } = panel(value); await userEvent.click(button("服用登记原瓶"));
    const review = screen.getByRole("region", { name: "古代学者原瓶服用确认" });
    for (const text of ["原批AS3-BATCH-1", "当前成功率72%", "尚余3次", "每次12便士", "成功或失败都会实际消耗", "14天", "普通战斗死亡"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "所选原瓶与真实来源" }).textContent).not.toContain("AS3-BOTTLE-2");
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "AS3-BOTTLE-1", confirmed: true });
  });

  it("forwards one exact sourced preparation command without claiming its result", async () => {
    const command: AncientScholarCommand = { type: "VERIFY_RECORD", recordId: "AS3-RECORD-145" };
    const value = projection({ actions: [action(command, "核验原航运合卷", "1行动 · 比对押印")] }), before = structuredClone(value);
    const { onCommand } = panel(value);
    const preparationFold = screen.getByText("史料、原瓶与设施准备 · 1 项公开行动", { selector: "summary" }).closest("details")!;
    expect(preparationFold.open).toBe(false);
    await open("史料、原瓶与设施准备 · 1 项公开行动"); expect(preparationFold.open).toBe(true);
    fireEvent.click(button("核验原航运合卷"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps old people and objects read-only and plainly separates the original G successor", async () => {
    const value = projection({ eraClosed: true, actions: [action({ type: "WORK" }, "本时代档案劳动")] });
    value.ritual.people = ["AS3-MARA玛拉·森于出发38年后84岁故去。", "AS3-ELIN艾琳·萨尔，当前32岁，不是玛拉或保证血亲。", "旧超凡人物去向未知。"];
    value.ritual.objects.push("室外原药剂已经过期；旧装备旧位置只读保留。");
    const { onCommand } = panel(value); await open("旧人、旧物与不可逆时代后果");
    const people = screen.getByRole("region", { name: "旧人与当代保管人" });
    for (const text of ["84岁故去", "AS3-ELIN", "当前32岁", "去向未知"]) expect(people.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "原件保护与旧物去向" }).textContent).toContain("已经过期");
    expect(within(people).queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("不代表原著未来");
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("本时代档案劳动")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WORK" });
  });

  it("shows finite historical practice without moving the original or inventing a sample", async () => {
    const value = projection({ promoted: true, eraClosed: true, insideCase: true, actions: [action({ type: "MOVE_TAG_IMAGE" }, "把唯一影像搬到两米桌角", "0行动 · 原件不动", { id: "AS3-LIFE:MOVE_TAG_IMAGE" })] });
    value.life = { insideCase: true, environment: "初晋G，既有样本和当下维持成本必需。", cases: [{ id: "old-tag", title: "同一原签", story: "本人已真实观察原签，原件仍在携笼。", observations: ["初学容量1，最多30秒G"], preparation: null, result: null, status: "ACTIVE", contactOpen: "本项尚未收束", closes: 0 }],
      practice: { activeCase: "old-tag", ownerAt: "PRESENT_MAT", borrowedReserve: 0, reserveSpent: 0, borrowRemainingSeconds: 0, image: { id: "TEST:AS3-IMAGE:1", sourceId: "BR4-TAG-1", massGrams: 1, remainingSeconds: 30, position: "NEAR" }, shelterRemainingSeconds: 0, elapsedSeconds: 0, sample: null, fragment: null, facts: ["原签始终在BR4-CARRIER-1，影像不是原物。"] } };
    const before = structuredClone(value), { onCommand } = panel(value);
    const practice = screen.getByRole("region", { name: "当下身体与临时效果" });
    for (const text of ["TEST:AS3-IMAGE:1", "BR4-TAG-1", "1克", "30 秒", "BR4-CARRIER-1"]) expect(practice.textContent).toContain(text);
    await open("有限能力与真实历史来源");
    const boundary = screen.getByRole("region", { name: "古代学者能力边界" });
    for (const text of ["最多30秒", "容量1", "原物不变", "真实曾拥有", "维持成本", "不能作为任意无敌退出", "未知的秘密"]) expect(boundary.textContent).toContain(text);
    fireEvent.click(button("把唯一影像搬到两米桌角")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "MOVE_TAG_IMAGE" }); expect(value).toEqual(before);
  });

  it("keeps the optional new original opponent and new supplies separate from expired old inventory", async () => {
    const value = projection({ promoted: true, eraClosed: true, actions: [action({ type: "ENCOUNTER_TALK" }, "普通拒绝后世争议并离开", "1行动 · 无追逐", { id: "AS3-ENCOUNTER:ENCOUNTER_TALK" })] });
    value.encounter = { encounter: {
      name: "鲁克·文恩", story: "本时代原人41岁，既非旧人复活也非历史影像；真实受伤和死亡风险。", sequence: 4, age: 41,
      status: "AVAILABLE", targetId: "AS3-ROOK-VENN", attemptWeek: null, startHistoryIndex: null,
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: "RESISTING", enemyInjuries: [], enemyRisk: 0,
      powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, terminal: null,
      supplies: { kitId: "AS3-CURRENT-KIT-1", purchasedWeek: null, pricePaid: 0, clubId: "AS3-NEW-CLUB", clubHeld: false, paperSheets: 0, paperSpent: 0,
        lampId: "AS3-NEW-LAMP", oilHeld: 0, oilSpent: 0, lanternPreparedWeek: null },
      originalExit: "当代净空外院普通出口", pursuit: false, distanceMetres: 2, noBystanders: true, abilities: [],
      facts: ["尚未购入本时代器材，旧纸、旧油与旧预制纸人只保历史。", "原人AS3-ROOK-VENN自己的棍与原120灵性不由旧敌继承。"],
    } };
    const before = structuredClone(value), { onCommand } = panel(value);
    const encounterFold = screen.getByText("新遭遇与本时代器材（可选）", { selector: "summary" }).closest("details")!;
    expect(encounterFold.open).toBe(false); await open("新遭遇与本时代器材（可选）"); expect(encounterFold.open).toBe(true);
    const encounter = screen.getByRole("region", { name: "后世原人遭遇" });
    for (const text of ["AS3-ROOK-VENN", "灵性 120", "旧纸"]) expect(encounter.textContent).toContain(text);
    expect(encounter.textContent).toContain("既非旧人复活也非历史影像");
    fireEvent.click(button("普通拒绝后世争议并离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" }); expect(value).toEqual(before);
  });

  it("closes only the page without cancelling preparation, exiting or changing original data", () => {
    const value = projection(), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭古代学者页面")); expect(onClose).toHaveBeenCalledTimes(1); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
