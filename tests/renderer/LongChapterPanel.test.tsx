/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LongChapterPanel, type LongChapterPanelProps } from "../../src/renderer/LongChapterPanel";
import type { LongChapterCommand, LongChapterProjection } from "../../src/domain/long-chapter/types";

type Action = LongChapterProjection["actions"][number];
const makeAction = (command: LongChapterCommand, label: string, cost = "0行动", extra: Partial<Action> = {}): Action => ({
  id: command.type, label, cost, enabled: true, reason: null, command, ...extra,
});
const payment = () => makeAction({ type: "PAY_RESIDENCE", confirmed: true }, "落实长期供养", "1行动 · 实付160便士");
const advance = () => makeAction({ type: "LIVE_TO_CYCLE", confirmed: true }, "生活至原登记周年", "不可逆推进至1411年6月12日");
/** Deliberate renderer-only projection fixture; it is not a natural game run or promotion proof. */
const projection = (extra: Partial<LongChapterProjection> = {}): LongChapterProjection => ({
  available: true, started: true, eraClosed: false, locked: true, phase: "PREPARING",
  title: "首次六十年周期安排", summary: "已完成四项不同的原档案劳动，原记忆册仍在原箱。",
  boundary: "本作G固定居所与有限后世。三百年隔绝和序列3尚未开放。",
  consequences: ["旧职业约定将结束，不补发多年工资。", "伊芙琳出发时44岁，出发39年后故去。", "乔里旧约定结束，去向未知；不据普通寿命判死。"],
  dates: ["实际晋升：1351年6月12日", "当前日期：1351年8月14日", "首次周期周年：1411年6月12日"],
  body: "同一原身体 TEST-RUN:body，当前健康100，入驻原灵性102。",
  currentIdentity: "创建身份仍有外部记录；尚未发生周期失忆。",
  people: ["原登记员艾达·芬恩 · LC-ADA-FENN · 入驻登记34岁。", "伊芙琳原见证来源仍保留；未来去向按实际经过记录。"],
  objects: ["唯一原册 UDY4-BOOK-1 · 原三页 UDY4-ENTRY-1、UDY4-ENTRY-2、UDY4-ENTRY-3 · CARE_CHEST。", "原随身手杖 OLD-CANE-1 · 有来源的普通非消耗品。"],
  memory: ["尚未发生本次周期失忆，已寻回来源0项。"], history: ["旧人、原物和原消耗记录只读保留。"],
  occupation: "原职业现仍属原时代；付费与实际跳时分别提交。",
  actions: [payment(), makeAction({ type: "BOOK_OUT" }, "亲手取回原记忆册"), makeAction({ type: "CANCEL" }, "取消安排，返回原时代")],
  ...extra,
});
function panel(value = projection(), props: Partial<Omit<LongChapterPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<LongChapterPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
afterEach(cleanup);

describe("LongChapterPanel projected facts and separate commitments", () => {
  it("shows actual projected dates, original IDs and human consequences without inventing a recovery", () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of value.dates) expect(screen.getByRole("region", { name: "真实日期与经过" }).textContent).toContain(entry);
    for (const entry of value.people) expect(screen.getByRole("region", { name: "旧人后果与本时代守护人" }).textContent).toContain(entry);
    for (const entry of value.objects) expect(screen.getByRole("region", { name: "同一原物与处置" }).textContent).toContain(entry);
    const memories = screen.getByRole("region", { name: "外部记录与部分记忆" });
    expect(memories.textContent).toContain("读到原册或历史文字不等于本人已经想起");
    expect(memories.textContent).toContain("已寻回来源0项");
    expect(screen.getByRole("region", { name: "本次安排的真实后果" }).textContent).toContain("去向未知");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("reviews payment without charging and cancels back to the same focused action", async () => {
    const { onCommand } = panel(); await userEvent.click(button("落实长期供养"));
    const confirmation = screen.getByRole("region", { name: "长期供养付费确认" });
    expect(document.activeElement).toBe(within(confirmation).getByRole("heading", { name: "支付当前余款，落实长期供养？" }));
    for (const text of ["实付160便士", "总额960便士", "各抵扣200便士", "不推进六十年", "已经实际支付的供养款不退款", "还需另一项不可逆确认"])
      expect(confirmation.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "暂不付费，返回安排" }));
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull();
    expect(document.activeElement).toBe(button("落实长期供养")); expect(onCommand).not.toHaveBeenCalled();
  });

  it("treats Escape as cancelling only the unsubmitted local payment review", async () => {
    const { onCommand, onClose } = panel(); await userEvent.click(button("落实长期供养"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("落实长期供养"));
  });

  it("submits payment once and needs a separate fresh confirmation before advancing time", async () => {
    const { onCommand, defaults, rerender } = panel(); await userEvent.click(button("落实长期供养"));
    const pay = screen.getByRole("button", { name: "确认支付当前余款，仅落实供养" });
    fireEvent.click(pay); fireEvent.click(pay);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PAY_RESIDENCE", confirmed: true });
    expect((pay as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "长期供养付费确认" })).toBeTruthy();
    const committed = projection({ phase: "RESIDING", summary: "已实际支付160便士，原周年尚未到达。", actions: [advance()] });
    rerender(<LongChapterPanel {...defaults} value={committed} />);
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull();
    await userEvent.click(button("生活至原登记周年"));
    const review = screen.getByRole("region", { name: "不可逆时代推进确认" });
    for (const text of ["不可逆", "1411年6月12日", "不从今天重算六十年", "同一身体的周期性死亡", "7天", "原著实际复起时长未知", "普通战斗死亡不因此获得复起入口", "部分核心事实"])
      expect(review.textContent).toContain(text);
    expect(onCommand).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "确认不可逆推进至首次周年" }));
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: "LIVE_TO_CYCLE", confirmed: true });
  });

  it("declines the irreversible advance without cancelling paid residence or changing original objects", async () => {
    const value = projection({ phase: "RESIDING", actions: [advance()] }), before = structuredClone(value);
    const { onCommand } = panel(value); await userEvent.click(button("生活至原登记周年"));
    await userEvent.click(screen.getByRole("button", { name: "暂不推进，返回安排" }));
    expect(document.activeElement).toBe(button("生活至原登记周年"));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("invalidates an unsubmitted review if its actual cost or consequences change", async () => {
    const { defaults, rerender, onCommand } = panel(); await userEvent.click(button("落实长期供养"));
    const changed = projection({ actions: [{ ...payment(), cost: "1行动 · 实付360便士" }] });
    rerender(<LongChapterPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull();
    await userEvent.click(button("落实长期供养"));
    expect(screen.getByRole("region", { name: "长期供养付费确认" }).textContent).toContain("实付360便士");
    rerender(<LongChapterPanel {...defaults} value={{ ...changed, consequences: ["本次安排已改变，必须重新阅读。"] }} />);
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("honors a newly blocked projected action while its confirmation remains readable", async () => {
    const { defaults, rerender, onCommand } = panel(); await userEvent.click(button("落实长期供养"));
    rerender(<LongChapterPanel {...defaults} value={projection({ actions: [{ ...payment(), enabled: false, reason: "原记忆册已不在保管箱。" }] })} />);
    const confirm = screen.getByRole("button", { name: "确认支付当前余款，仅落实供养" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(screen.getByRole("region", { name: "长期供养付费确认" }).textContent).toContain("原记忆册已不在保管箱");
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "暂不付费，返回安排" }));
  });

  it("does not leave an obsolete confirmation open after changing phase", async () => {
    const { defaults, rerender, onCommand } = panel(); await userEvent.click(button("落实长期供养"));
    rerender(<LongChapterPanel {...defaults} value={projection({ phase: "CANCELLED", actions: [makeAction({ type: "REVIEW" }, "重新查看长期安排")] })} />);
    expect(screen.queryByRole("region", { name: "长期供养付费确认" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "首次六十年周期安排" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["busy", "blocked"] as const)("locks all actions and page dismissal while %s", flag => {
    const { onCommand, onClose } = panel(projection(), { [flag]: true });
    for (const item of screen.getAllByRole("button") as HTMLButtonElement[]) { expect(item.disabled).toBe(true); fireEvent.click(item); }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the same paid operation pending after a save failure and directs retry to the save error", async () => {
    const { defaults, rerender, onCommand, onClose } = panel(); await userEvent.click(button("落实长期供养"));
    fireEvent.click(screen.getByRole("button", { name: "确认支付当前余款，仅落实供养" }));
    rerender(<LongChapterPanel {...defaults} error={{ message: "保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("当前仍显示上次已保存的记录");
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const item of screen.getAllByRole("button") as HTMLButtonElement[]) expect(item.disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("button", { name: "确认支付当前余款，仅落实供养" }));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
  });

  it("describes a nonretryable save failure without offering a second mutation", () => {
    const { onCommand } = panel(projection(), { error: { message: "版本已改变", retryable: false } });
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    fireEvent.click(button("亲手取回原记忆册")); expect(onCommand).not.toHaveBeenCalled();
  });

  it("sends the projected original-book return once and waits for a committed value", () => {
    const { onCommand, defaults, rerender } = panel(); const take = button("亲手取回原记忆册");
    fireEvent.click(take); fireEvent.click(take);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BOOK_OUT" });
    rerender(<LongChapterPanel {...defaults} busy />);
    expect(button("取消安排，返回原时代").disabled).toBe(true);
    const committed = projection({ objects: ["UDY4-BOOK-1 · 同一原册已实际取回PLAYER。"], actions: [makeAction({ type: "CANCEL" }, "取消安排，返回原时代")] });
    rerender(<LongChapterPanel {...defaults} value={committed} />);
    fireEvent.click(button("取消安排，返回原时代"));
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: "CANCEL" });
  });

  it("forwards the exact selected distinct support task without inferring successful work", () => {
    const command: LongChapterCommand = { type: "PREPARE_SUPPORT", taskId: "COPY_HANDOVER" };
    const value = projection({ actions: [makeAction(command, "核抄原交接记录", "1行动 · 抵扣200便士")] });
    const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button("核抄原交接记录")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows the independently persisted cycle-death state with only its offered waiting action", () => {
    const value = projection({ phase: "CYCLE_DEAD", eraClosed: true,
      title: "同一身体的周期性死亡", summary: "已到1411年6月12日，尚未复起。",
      body: "TEST-RUN:body · LC-CARE-HOUSE · 健康0，入驻灵性102仍有记录。",
      actions: [makeAction({ type: "AWAIT_REVIVAL" }, "等待本作G的7天复起", "真实推进7天")],
    });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "同一身体与当前身份" }).textContent).toContain("周期性死亡");
    expect(screen.getByRole("region", { name: "长期章节当前处境" }).textContent).toContain("不代表原著未来");
    expect(screen.queryByRole("button", { name: /旧职业工作|恢复全部记忆|直接战斗复活/ })).toBeNull();
    fireEvent.click(button("等待本作G的7天复起"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "AWAIT_REVIVAL" }); expect(value).toEqual(before);
  });

  it("presents new-era ordinary actions and partial recovery without presenting former people as current", () => {
    const value = projection({ phase: "PARTIAL_RECOVERY", eraClosed: true, locked: false,
      people: ["伊芙琳于1390年8月14日故去；当年44岁原记录仍可查。", "现任莉娜·沃斯 LC-LENA-VOSS，第三任保管人，不是原见证人。", "乔里旧约定已终止，去向未知。"],
      objects: ["UDY4-BOOK-1 已实际取回PLAYER。", "原未保护耗材已过期，不可再用。"],
      memory: ["身份页 UDY4-ENTRY-1、首案页 UDY4-ENTRY-2、灰羽页 UDY4-ENTRY-3：仅部分寻回。"],
      occupation: "新接待处普通工作1行动得24便士；休整1行动实耗8便士。",
      actions: [makeAction({ type: "WORK" }, "本时代档案劳动", "1行动 · 收入24便士"), makeAction({ type: "REST" }, "本时代休整", "1行动 · 支出8便士"), makeAction({ type: "LEAVE_RECEPTION" }, "实际走出新接待处")],
    });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "旧人后果与本时代守护人" }).textContent).toContain("现任莉娜");
    expect(screen.getByRole("region", { name: "外部记录与部分记忆" }).textContent).toContain("仅部分寻回");
    expect(screen.getByRole("region", { name: "同一原物与处置" }).textContent).toContain("已过期");
    fireEvent.click(button("实际走出新接待处")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_RECEPTION" });
  });

  it("keeps reading external pages separate from the explicit partial-recovery command", () => {
    const value = projection({ phase: "AMNESIAC", eraClosed: true,
      memory: ["原身份页 UDY4-ENTRY-1 可读，尚未本人寻回。"],
      actions: [makeAction({ type: "RECOVER_IDENTITY" }, "依原身份页寻回有限身份", "1行动")],
    });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "外部记录与部分记忆" }).textContent).toContain("尚未本人寻回");
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("依原身份页寻回有限身份"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RECOVER_IDENTITY" });
    expect(value).toEqual(before);
  });

  it("closes the page without submitting cancellation, taking the book, or advancing a date", () => {
    const value = projection(), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(screen.getByRole("button", { name: "关闭长期章节页面" }));
    expect(onClose).toHaveBeenCalledTimes(1); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
