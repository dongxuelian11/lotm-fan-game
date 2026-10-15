import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { DiscernerAction, DiscernerCommand, DiscernerProjection } from '../domain/discerner/types';
import './seer-styles.css';

const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const NODE = { NEAR: '原近桌', FAR: '原远桌' } as const;
const CASE_STATUS: Record<string, string> = {
  AVAILABLE: '尚未观察', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '待报告', RESOLVED: '已报告',
};
const PERMISSION = { UNASKED: '尚未询问', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已撤回' } as const;
const IMPRINT = { NONE: '尚未尝试', BLOCKED: '被原保护封签阻挡，未取得线索', FAILED: '检定失败，未取得线索', REVEALED: '取得一项有限象征线索' } as const;
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' } as const;
const ACQUISITION_TYPES = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'CONSUME']);
const ENCOUNTER_TYPES = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'AID_ENEMY']);
const RETURN_TYPES = new Set(['MOVE', 'STOP_CONTACT', 'WAIT_MARK', 'DEACTIVATE_SEAL', 'RETURN_CARD', 'CLOSE', 'WITHDRAW', 'REVOKE_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const isReturn = (action: DiscernerAction) => RETURN_TYPES.has(action.command.type);
type Confirmation = { actionId: string; bottleId: string; facts: string };
type Attempt = NonNullable<DiscernerProjection['life']['currentAttempt']>;

export interface DiscernerPanelProps {
  value: DiscernerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DiscernerCommand) => void;
  /** View navigation only. Physical return and contact closure use the projected commands. */
  onClose?: () => void;
}

/** Public committed facts only; local selections never disclose a card or settle an action. */
export function DiscernerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DiscernerPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const practice = value.life.practice;
  const attempt = value.life.currentAttempt;
  const encounter = value.encounter;
  const selectedCase = value.life.cases.find(entry => entry.id === practice?.activeCase)
    ?? value.life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED')
    ?? value.life.cases.find(entry => entry.id === caseId)
    ?? value.life.cases.find(entry => entry.status !== 'RESOLVED')
    ?? value.life.cases[0];
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const returnActions = currentActions.filter(isReturn);
  const nextAction = currentActions.find(action => action.enabled && action.command.type === 'CONSUME')
    ?? currentActions.find(action => action.enabled && !isReturn(action))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const liveConfirmation = confirmation?.facts === facts
    ? value.actions.find(action => action.id === confirmation.actionId && action.command.type === 'CONSUME' && action.command.bottleId === confirmation.bottleId)
    : undefined;
  const confirmedBottle = confirmation ? value.bottles.find(bottle => bottle.id === confirmation.bottleId) : undefined;
  const disclosedClues = practice?.knownClues.filter(clue => clue.caseId === selectedCase?.id) ?? [];

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    // A pending or failed save keeps the same intent locked, even after the modal is gone.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null;
      submittedFacts.current = null;
      setSubmittedId(null);
      setConfirmation(null);
      summaryHeading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) {
      setConfirmation(null);
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancelButton.current?.focus();
    } else if (submitted.current !== null) {
      summaryHeading.current?.focus();
    } else if (returnActionId.current) {
      (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
    }
  }, [confirmation]);

  function submit(action: DiscernerAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setSubmittedId(action.id);
    // Unmount the modal before awaiting persistence, so the parent's same-envelope retry remains reachable.
    setConfirmation(null);
    onCommand(action.command);
  }
  function choose(action: DiscernerAction) {
    if (locked || submitted.current !== null || confirmation || !action.enabled) return;
    if (action.command.type === 'CONSUME') {
      const id = action.command.bottleId;
      if (value.promoted || !value.bottles.some(bottle => bottle.id === id)) return;
      returnActionId.current = action.id;
      setConfirmation({ actionId: action.id, bottleId: id, facts });
    } else submit(action);
  }
  function cancelConfirmation() {
    if (!locked && submitted.current === null) setConfirmation(null);
  }
  function actionList(actions: DiscernerAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `discerner-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`discerner-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resourceFacts(label: string) {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label={label}><h4>当前实际资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div>
        <div><dt>排异</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{current.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
      </dl>
    </section>;
  }
  function attemptFacts(entry: Attempt, index: number) {
    return <div key={index}>
      <p>第{entry.week}周 · {entry.method === 'ABILITY' ? '能力方式准备' : '普通方式准备'} · {entry.closed ? entry.withdrawn ? '已实际撤出' : '已实际收束' : '本次尚未收束'}。</p>
      <p>能力许可：{PERMISSION[entry.contactPermission]}；原卡交接与实读许可：{PERMISSION[entry.materialPermission]}。</p>
      <p>印记尝试：{IMPRINT[entry.imprintResult]}。{entry.check && `实际意志检定 ${entry.check.roll} / ${entry.check.chance}，${TIER[entry.check.tier]}。`}</p>
      <p>实耗灵性 {entry.spiritualitySpent}、本人精神 {entry.ownerMindSpent}；实际经过 {entry.elapsedSeconds} 秒，本人行走 {entry.ownerTravelMetres} 米。</p>
      <p>原卡{entry.cardReturned ? '已亲手归还原主人' : entry.cardTaken ? '已交给本人，仍须实际归还' : '没有交到本人手中'}；{entry.cardChecked ? '本人已在近桌实读' : '本人尚未在近桌实读'}。</p>
      <p>结果：{entry.result === 'ABILITY' ? '实际印记线索与同一原卡已完成核验' : entry.result === 'ORDINARY' ? '普通原卡核验已完成' : '尚无完成结果'}；{entry.verified ? '已明确复核' : '尚未明确复核'}。</p>
    </div>;
  }

  return <section className="seer-panel warrior-panel discerner-panel" aria-label="洞察者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="洞察者当前目标">
      <span className="seer-seal">{value.promoted ? '洞察者2 · 有限印记与现实核验' : '织梦人3 → 洞察者2'}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ''}`
        : value.acting >= 100 ? '本阶实践已消化，可以继续普通生活。' : '查看公开条件，或继续普通生活。'}</p>
      <p>{value.digestion}</p>
    </section>
    {resourceFacts('洞察者当前资源')}
    {error !== null && <p className="slice-notice" role="alert">{playerText(typeof error === 'string' ? error : error.message)} 当前仍显示上次已保存的记录。
      {typeof error !== 'string' && error.retryable === false ? '请按上方错误提示重新加载。' : '请使用上方保存错误处的同次重试，继续原操作；不要重新付费、施术、交卡或服药。'}</p>}
    {(busy || submittedId !== null) && error === null && <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。保存回执到达前不接受重复行动。</p>}

    {!value.promoted && selectedBottle && <section aria-label="当前独立洞察者原瓶"><h4>本次独立原瓶</h4>
      <label className="seer-case-selector">选择洞察者原瓶<select aria-label="选择独立洞察者原瓶" disabled={locked || confirmation !== null} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p><p>{selectedBottle.source}</p>
      <p>买到原瓶、完成专业准备与服药是不同操作；服药须再次独立确认。</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前洞察者生活情境">
      <label className="seer-case-selector">选择生活情境<select aria-label="选择洞察者生活情境" disabled={locked || value.insideCase || confirmation !== null} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {value.life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.observations.length > 0 && <ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
      {selectedCase.preparation && <p>{selectedCase.preparation}</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">普通方法同样可完成。拒绝、撤回、失败或保护阻挡均不证明恶意；没有实际成功印记，就没有对应掌握奖励。</p>
    </section>}

    {value.promoted && !encounter.inside && practice && <section aria-label="洞察者当前原场"><h4>本人、有限接触与唯一原卡</h4>
      <p>原场 {practice.sceneId} · 本人在{NODE[practice.ownerNode]}。两桌相距3米，须沿开放普通路真实走返。</p>
      {attempt ? <section className="slice-notice" aria-label="本次许可与有限印记">
        <p>近距能力许可：{PERMISSION[attempt.contactPermission]}；原卡交接与实读许可：{PERMISSION[attempt.materialPermission]}。两份许可独立，旧案同意不沿用。</p>
        <p>当次印记：{attempt.markFormed ? attempt.markRemainingSeconds > 0 ? `由目标实际看原卡形成，尚余 ${attempt.markRemainingSeconds}${playerText(" 秒（G）")}` : '已实际形成并到期' : '目标尚未实际看卡形成'}。</p>
        <p>近距尝试：{IMPRINT[attempt.imprintResult]}。一案只有一次，失败或阻挡仍付实际6灵性与本人2精神，不能重骰。</p>
        <p>当前接触：{attempt.contactActive ? '正在持续，可立即停止' : attempt.contactEnd === 'STOPPED' ? '已经明确停止' : attempt.contactEnd === 'WITHDRAWN' ? '因许可撤回而结束' : attempt.contactEnd === 'EXPIRED' ? '已经真实到期' : '没有持续中的接触'}。</p>
        <p>停止只结束影响；身体仍在{NODE[practice.ownerNode]}，原卡不会自动归还。实际 {attempt.elapsedSeconds} 秒、本人 {attempt.ownerTravelMetres} 米，已付 {attempt.spiritualitySpent} 灵性与本人 {attempt.ownerMindSpent} 精神。</p>
      </section> : <p>当前没有未收束的本案尝试。下次实践须分别取得当前许可。</p>}
      <section aria-label="原卡实际持有与归还"><h4>三张原卡的实际去向</h4>
        {Object.values(practice.cards).map(card => <article key={card.id}>
          <p><strong>{card.id}</strong> · 所有人 {practice.participants[card.ownerId].name}（{card.ownerId}） · {card.holder === 'TARGET' ? '原主人持有' : '本人持有，尚须亲手归还'} · 实际在{NODE[card.node]}。</p>
          {card.marking !== undefined ? <p>本人已实际实读的原卡内容：{card.marking}</p> : <p className="slice-muted">原卡内容尚未向本人实际披露。</p>}
        </article>)}
        <p>近距线索不能代替原物：自愿交卡后，本人须带同一卡回近桌实读，再走到远桌归还，最后回到近桌才能结束。</p>
      </section>
      <section aria-label="已实际披露的本案线索"><h4>本案已知内容及来源</h4>
        {disclosedClues.length > 0 ? disclosedClues.map((clue, index) => <article key={`${clue.sourceId}-${clue.source}-${index}`}>
          <p>{clue.text}</p><p className="slice-muted">第{clue.week}周 · {clue.source === 'FINITE_IMPRINT' ? '近距接触所得的有限象征，不是客观证明' : '本人实际翻看同一原卡'} · 来源 {clue.sourceId}。</p>
        </article>) : <p>尚未取得本案线索或实读内容。形成印记、走近、取得许可或启用保护都不会自动披露内容。</p>}
      </section>
      <section aria-label="原保护封签"><h4>原保护封签与拒止</h4>
        <p>{practice.seal.id} · {practice.participants[practice.seal.ownerId].name}始终持有 · 在{NODE[practice.seal.node]} · {practice.seal.active ? '当前已启用' : '当前未启用'} · 剩余额度 {practice.seal.charges}。</p>
        <p>{practice.seal.scope}</p><p>保护阻挡不等于恶意；停止或耗尽也不会自动泄漏内容。</p>
      </section>
    </section>}

    <section aria-label="洞察者当前行动"><h4>{value.insideCase ? '当前现场的下一步' : '当前可选行动'}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isReturn(action)), '洞察者公开行动') : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {returnActions.length > 0 && <section aria-label="洞察者移动停止与普通退路"><h4>本人移动、停止与原物返还</h4>
        {actionList(returnActions, '洞察者普通走返与收束行动')}
        <p className="slice-muted">归还原物、走回与结束现场须分别实际完成。关闭页面不会完成这些动作，实付成本不退。</p>
      </section>}
    </section>

    {value.promoted && practice && <details className="seer-fold"><summary>三名成年人的当前许可与资源</summary>
      <section aria-label="洞察者本案成年人"><h4>每个人、每种用途分别确认</h4>
        <ul>{Object.values(practice.participants).map(person => {
          const consent = value.life.currentConsents.find(entry => entry.id === person.id);
          return <li key={person.id}><strong>{person.name}</strong> · {person.age}岁 · {person.id}
            <p>在{NODE[person.node]} · 健康 {person.health} / 100 · 精神 {person.mind} / 100。</p>
            <p>{consent ? `本次能力接触${consent.consented ? '当前同意' : '当前未同意'}；原卡交接与实读${consent.materialConsented ? '当前同意' : '当前未同意'}。` : '当前没有此人的本次有效许可。'}</p>
          </li>;
        })}</ul>
        <p>本人6灵性与2精神的能力代价真实保存；本场练习不会伤害参与者心智，撤回也不推断私密内容。</p>
      </section>
    </details>}
    {value.promoted && value.life.cases.length > 0 && <details className="seer-fold"><summary>实际尝试、核验结果与报告记录</summary>
      {value.life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? '尚无实际完成结果。'} · 已收束 {entry.closes} 次 · {entry.contactOpen ? '当前原场尚未结束' : '没有本项未结束现场'}。</p>
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{value.life.reflected ? '三案后的反思已实际完成。' : '三案后的反思尚未完成。'}</p><p>{value.life.environment}</p><p>{value.life.source}</p>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与三项晋升准备")}</summary>
      <section aria-label="洞察者成品与配方边界"><h4>{playerText("专业支持与独立序列2成品")}</h4>
        <p>{playerText("完整配方、材料用量与原著晋升仪式仍未知。三项专业准备与当周场地检查均为本作G，不代称原著仪式。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? '尚未实际完成' : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>本次场地检查：{value.preparedWeek === null ? '没有已保存的当次检查' : `第${value.preparedWeek}周`}。</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、既往经历与能力掌握</summary>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变身体性别。</p>
      <ul>{value.inheritedHistory.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
      <section aria-label="洞察者有限能力与实际掌握"><h4>本阶新能力</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>只展示公开已知能力与实际掌握；有限线索不是客观证词，抵抗不会透露隐藏往事或未公开能力。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && encounter.enemy && <details className="seer-fold" open={encounter.inside}><summary>新原人的可选冲突与普通退出</summary>
      <section aria-label="洞察者独立原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
        <p>{encounter.enemy.name} · {encounter.enemy.age}岁 · {encounter.enemy.id}{playerText(" · 本场G序列")}{encounter.enemy.sequence}等效。</p>
        <p>健康 {encounter.enemy.health} · 精神 {encounter.enemy.mind} · 独立灵性 {encounter.enemy.spirituality} · {encounter.enemy.status === 'DEAD' ? '已经真实死亡' : encounter.enemy.status === 'SURRENDERED' ? '仍是原人，已投降停止抵抗' : '仍有独立意志'}。</p>
        <p>原棍 {encounter.enemy.weaponId} · {encounter.enemy.weaponLocation === 'HAND' ? '仍在原人手中' : '留在原院'}。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>本场实际印记使用 {encounter.mentalImprintUses} 次、成功 {encounter.mentalImprintSuccesses} 次；洞察窗口使用 {encounter.insightWindowUses} 次、成功 {encounter.insightWindowSuccesses} 次。使用与成功分别记录，不冒称每次必涨对应掌握。</p>
        <p>已实际退出步行 {encounter.exitTravelMetres} 米、{encounter.exitSeconds} 秒。原精神瘟疫强度 {encounter.mentalPlague}，离场不自动清除。</p>
        {encounter.helpHistory.length > 0 && <ul>{encounter.helpHistory.map((entry, index) => <li key={index}>第{entry.week}周原人自愿接受专业稳定：{entry.before}→{entry.after}，实付{entry.fee}便士；健康精神不补满。</li>)}</ul>}
        {!encounter.inside && actionList(encounterActions, '洞察者可选遭遇行动')}
      </section>
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation && submitted.current === null) onClose(); }}>关闭洞察者页面</button>}

    {confirmation && confirmedBottle && <dialog ref={dialog}
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      className="seer-panel seer-confirmation" aria-labelledby="discerner-confirm-title"
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={event => { event.preventDefault(); cancelConfirmation(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelConfirmation(); } }}>
      <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
      <h3 id="discerner-confirm-title">确认服用{confirmedBottle.title}？</h3>
      <p>原瓶 {confirmedBottle.id} · {confirmedBottle.status}</p><p>来源：{confirmedBottle.source}</p>
      <p>当前成功率 {confirmedBottle.chance}% · 本次消耗：{liveConfirmation?.cost ?? '公开条件已变化，请返回重新查看'}。</p>
      <p>指导500便士；三项专业准备各1行动；独立原瓶6200便士，或本瓶五项实际劳务抵5400便士后付800便士。另付当次1行动与120便士完成场地检查，服药本身0行动。</p>
      <p>本次场地检查：{value.preparedWeek === null ? '尚无已保存的当次检查' : `第${value.preparedWeek}周`}{playerText("。完整配方与原著晋升仪式仍未知，当前专业支持、准备和具体执行规则全为本作G。")}</p>
      <section className="slice-notice seer-risk" aria-label="洞察者服药四档结果与实际风险"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
      <p>确认后，无论成功或失败都耗尽这一原瓶和当次场地准备，已付成本不退。排异支持只适用于本次药物后果，不保护战斗、普通死亡或提供复活。</p>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。成功不改身体性别，两项新掌握从0开始，原21项掌握与既往经历保留；灵性上限仍120，当前灵性不补满。</p>
      {resourceFacts('洞察者服药确认当前资源')}
      {liveConfirmation?.reason && <p className="seer-action-reason" id="discerner-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons">
        <button ref={cancelButton} className="slice-button quiet" disabled={locked} onClick={cancelConfirmation}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
          aria-describedby={liveConfirmation?.reason ? 'discerner-confirm-reason' : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
      </div>
      <p className="slice-muted">取消或ESC只关闭尚未提交的确认，不服药、不退准备、不移动身体。提交后保留原意图；保存失败请使用页面上方同次重试。</p>
    </dialog>}
  </section>;
}
