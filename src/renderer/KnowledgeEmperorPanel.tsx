import { useEffect, useRef, useState } from 'react';
import type { KnowledgeEmperorAction, KnowledgeEmperorCommand, KnowledgeEmperorProjection } from '../domain/knowledge-emperor/types.js';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_NOTE', 'RECOVER_ENERGY']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已停止，待普通收尾', ACTIVE: '现场尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '本人已死亡' };
const PLACE: Record<string, string> = { ENTRY: '原档案馆门口', A: '六米锚位', B: '十米档架', OUTSIDE: '室外', YARD: '独立阅览院', PLAYER: '本人处', OWNER: '原物主处', SUPPLIER: '供应方处', SUPPLY: '供应方处' };
const PERMISSION: Record<string, string> = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '判定成功，尚待实际应用', APPLIED: '已实际应用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', MOVED: '移动后已经失效' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const POLICIES: Record<string, string> = { INHERITED_ONLY: '只用已学能力', KNOWLEDGE_POWER: '允许知识赋力', POWER_KNOWLEDGE: '允许循力求知', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface KnowledgeEmperorPanelProps {
  value: KnowledgeEmperorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: KnowledgeEmperorCommand) => void;
  /** Navigation alone never applies a window, returns a note or moves a body. */
  onClose?: (() => void) | null;
}

export function KnowledgeEmperorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: KnowledgeEmperorPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: KnowledgeEmperorAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>()), returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value), currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || error !== null || pending || value.resources === null || value.resources.health === 0;
  const { life, encounter } = value;
  // The domain projection is the sole current authority. Never fall back to the
  // frozen Sage life snapshot, or create local bodies/items from old records.
  const site = life.site;
  const text = (prose: string) => value.characterName ? prose.split(value.characterName).map(playerText).join(value.characterName) : playerText(prose);
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.activeCase);
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && (goal === 'encounter' || goal === null && life.reflected));
  const inside = value.insideCase || life.inside || life.insideCase || encounter.inside || value.preparedWeek !== null;
  const selectionLocked = locked || confirmation !== null || inside;
  const entries = value.actions.filter(action => inEncounter ? ENCOUNTER.has(action.command.type)
    : value.promoted ? !ACQUISITION.has(action.command.type) && !ENCOUNTER.has(action.command.type)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup && !COMMON.has(action.command.type))
    ?? entries.find(action => action.enabled) ?? entries[0];
  const common = entries.filter(action => action !== next && (COMMON.has(action.command.type) || action.cleanup)).slice(0, 2);
  const alternatives = entries.filter(action => action !== next && !common.includes(action));
  const extra = alternatives.find(action => action.id === extraId) ?? alternatives[0];
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmedBottleId = live?.command.type === 'CONSUME' ? live.command.bottleId : null;
  const confirmedBottle = value.bottles.find(bottle => bottle.id === confirmedBottleId);
  const phase = `${value.promoted}:${inEncounter}:${selectedCase?.id}:${selectedBottle?.id}:${next?.id}`;

  useEffect(() => { if (!confirmation && !pending) heading.current?.focus(); }, [phase]);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setPending(false);
      returnActionId.current = null; setConfirmation(null); heading.current?.focus();
    } else if (error !== null || confirmation && confirmation.facts !== facts) {
      returnActionId.current = null; setConfirmation(null); heading.current?.focus();
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? heading.current)?.focus();
    else heading.current?.focus();
  }, [confirmation]);

  function choose(action: KnowledgeEmperorAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id; setConfirmation({ action, facts });
  }
  function submit(action: KnowledgeEmperorAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id; submittedFacts.current = facts; setPending(true); onCommand(action.command);
  }
  function actionControl(action: KnowledgeEmperorAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" data-action-id={action.id} disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `knowledge-emperor-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{text(action.label)}</strong><span className="slice-modifiers">{text(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`knowledge-emperor-reason-${encodeURIComponent(action.id)}`}>{text(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="知识皇帝当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="知识皇帝当前资源"><h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康恢复不代表旧伤已经消失。晋升与离场不会治疗伤势，也不会补满灵性、现场精力或耗材。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="知识皇帝成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{text(value.title)}</h2>
      <section aria-label="知识皇帝阶段总览">
        <p>当前阶段：{inEncounter ? `可选真实遭遇 · ${STATUS[encounter.status] ?? '当前记录'}` : value.promoted ? life.reflected ? '三份生活报告与反思已完成' : '原档案馆的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p>
        <p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 知识皇帝扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p>
      </section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : text(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {blocked && <p role="status">请先处理当前阻塞事项，本页暂不能提交新操作。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">{value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="知识皇帝目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked} onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{text(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：独立阅览院的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{text(bottle.title)} · {text(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="知识皇帝其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{text(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="知识皇帝服药准备">
        <p>{text(value.digestion)}</p><p>{text(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{text(selectedBottle.title)}</h3><p>{text(selectedBottle.source)}</p><p>{text(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{text(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士、1行动；每瓶7200便士，或为本瓶完成五项各1行动的真实劳动，获得6000便士抵额后支付1200便士。三项专业准备各1行动，当周准备另需1行动、180便士。全部原瓶失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>须从实际贤者晋升周起满12整周，消化100，完成旧三份报告、反思及本次专业准备。服药需健康高于20、精神高于40，并进行意志30检定；饮用本身不耗行动。供应方交付独立成品原瓶，未掌握完整配方，不能自行调配。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留贤者。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{text(value.risk)}</p><p>{text(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{text(value.digestion)}</p><p>{text(value.appearanceRecord)}</p><p>{text(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{text(ability.label)} · 掌握{ability.mastery}</h3><p>{text(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{text(value.environment)}关闭页面不会代替停手、归还纸页与普通步行离场；实际时间、伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="知识皇帝操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live ? text(live.label) : '现场已变化'}</h3><p>{live && text(live.cost)}</p>
      {confirmedBottle && <><p>{text(confirmedBottle.title)} · {text(confirmedBottle.status)}</p><p>{text(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p><p>{text(value.risk)}</p>
        <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶保留姓名、性别、年龄与既有性格。原有十三项能力及其实际掌握保留，两项新能力从0开始；原档页、原记录、旧耗材与参与者不会复制或补充。也可取消并继续停留贤者。</p></>}
      {live && ['KNOWLEDGE_POWER', 'POWER_KNOWLEDGE'].includes(live.command.type) && <p>{text(value.abilities.find(ability => ability.id === (live.command.type === 'KNOWLEDGE_POWER' ? 'hermit.s1.knowledge-power' : 'hermit.s1.power-knowledge'))?.description ?? '')}</p>}
      {live && 'permission' in live.command && <p>本次针对：{live.command.permission === 'OWNER' ? `${site.iris?.name ?? '原物主'}对原档页用途的许可` : `${site.iris?.name ?? '原物主'}对本次有限能力用途的许可`}。{live.command.type === 'WITHDRAW_CONSENT' ? '撤回立即停止新施法并清除未用窗口；已付代价保留，同一纸页仍须亲手归还。' : '只记录本案明确同意，之后仍可以撤回。'}</p>}
      {live?.command.type === 'SET_COMBAT_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不施法、不购买材料、不开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy?.name ?? '眼前的对手'}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；身体与精神作用分别结算，生还离场须实际步行4米。</p><p>{text(encounter.story)}</p></>}
      {live && operationFacts(live.command)}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{text(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因失败、停止或撤回而返还；秒数不会倒退，既有伤害与真实磨损不会撤销。撤回不会替人离场，每个人仍须普通行走。</p>
      {live?.reason && <p className="seer-action-reason">{text(live.reason)}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button></div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function originalFacts() {
    return <section aria-label="知识皇帝原人原物当前状态"><h3>同一本体、原档页与原成人</h3>
      <p>本人当前在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100，累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
      <p>当前身体：{site.body === 'SOLID' ? '完整实体' : '信息形态'}；{site.form.active ? '已有信息形态窗口仍按实际记录结算' : '当前没有信息形态窗口'}。既往形态实耗{site.formEnergySpent}精力，同化暴露{site.assimilationExposure}次。</p>
      {site.iris ? <p>{site.iris.name} · {site.iris.age}岁，当前在{PLACE[site.iris.location]}，独立精力{site.iris.energy}/100，累计实走{site.iris.travelMetres}米。原场地许可记录：{PERMISSION[site.iris.consent]}；这条既往记录不代替本案的两项新许可。</p> : <p>当前尚无已核对的原成人记录，不推定她已经到场或同意。</p>}
      <p>原记录页{site.record ? `${site.record.id}在${PLACE[site.record.location]}，实际行程${site.record.travelMetres}米` : '尚无已核对的位置'}。它与本案新购纸张分别记录。</p>
      <p>同一原档页{site.archive.id}仍在{PLACE[site.archive.location]}，实际阅读{site.archive.readings}次，已核验{site.archive.verifications}次。抄录只改变手中的同一张新纸，不移动或复制原档页。</p>
      <p>原导管{site.conduit.id}连接六米锚位与十米档架，全长{site.conduit.metres}米，已有实际通行{site.conduit.traversals}次；普通道路仍按实际距离行走。</p>
      <p>旧三份耗材：{site.materials.map(material => `${material.id}${material.status === 'RETURNED' ? '已归还' : '在' + PLACE[material.location]}，实际磨损${material.wear}，原价${material.paidPennies}便士`).join('；')}。</p>
      <p>当前位置与余量以上方事实为准。原成人、同一身体和原物不会因换案或晋升复制；旧灾难的封存、旧伤者的伤势和旧对手的撤退记录继续保留。</p>
    </section>;
  }

  function lifeFacts() {
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && !!selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const note = life.notes.find(entry => entry.caseId === selectedCase?.id);
    const pendingWindow = current && life.pending?.caseId === selectedCase?.id ? life.pending : null;
    const permitted = (permission: 'OWNER' | 'ABILITY') => {
      const state = selectedCase?.permission[permission] ?? 'UNASKED';
      return state === 'GRANTED' && (selectedCase?.status === 'EXAMINED' || selectedCase?.status === 'RESOLVED') ? '本案曾明确同意，当前已经结束' : PERMISSION[state];
    };
    const windowState = attempt?.windowEnd === 'ACTIVE' && !current ? '曾施放成功，本次已结束且未应用' : WINDOW[attempt?.windowEnd ?? 'NONE'];
    return <section aria-label="知识皇帝生活练习"><h3>{text(selectedCase?.title ?? life.title)}</h3><p>{text(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{text(selectedCase.result)}</p>}
      {attempt && !current && <p>以下尝试是当次已保存经历；同一本体、原成人与原物的当前位置以上方当前事实为准。</p>}
      <section aria-label="当前时钟与一次能力窗口"><h4>实际时间与下一次作用</h4>
        <p>现场时钟{life.clockSeconds}秒；{attempt ? `本次实际经过${attempt.elapsedSeconds}秒。` : '本案尚无实际尝试。'}页面停留不会自行推进现场，等待须提交实际等待动作。</p>
        {pendingWindow ? <><p>{pendingWindow.abilityId === 'hermit.s1.knowledge-power' ? '知识赋力' : '循力求知'}窗口：从{pendingWindow.createdAt}秒至{pendingWindow.expiresAt}秒，还剩{life.pendingRemainingSeconds}秒。</p>
          <p>只针对同一原档页、{pendingWindow.noteId}和本次仍有效的许可；{pendingWindow.forceReceiptId ? `已付力量凭据${pendingWindow.forceReceiptId}继续保留。` : '尚须对同一页实际应用，成功开窗不等于取得效果。'}</p></>
          : <p>当前没有尚未耗用的能力窗口。成功施放、实际应用、失败、到期与停止分别记录。</p>}
        <p>两项能力每次均需8灵性、2精神、知识18检定和1秒；窗口最长20秒。每案只能尝试一次，移动、遮挡、撤回、停止或到期使未用窗口失效，已经支付的成本不返还。</p>
        {attempt && <p>知识赋力检定：{attempt.knowledgePowerTier === null ? '尚未尝试' : TIER[attempt.knowledgePowerTier]}；循力求知检定：{attempt.powerKnowledgeTier === null ? '尚未尝试' : TIER[attempt.powerKnowledgeTier]}。窗口记录：{windowState}。</p>}
      </section>
      <section aria-label="本案的独立许可"><h4>原物用途与能力用途分别同意</h4><ul>
        <li>{site.iris?.name ?? '原物主'}对本案原档页用途的许可：{permitted('OWNER')}。</li>
        <li>{site.iris?.name ?? '原物主'}对本案有限能力用途的许可：{permitted('ABILITY')}。</li>
      </ul><p>每案重新询问，可分别撤回。撤回立即停止新施法并清除未用窗口；已付成本不退，仍须携同一纸页普通返回，亲手交还后再结束接触。</p></section>
      <section aria-label="同一纸张与有限记录"><h4>一张实付新纸，一份实际笔记</h4>
        {note ? <><p>本案纸张{note.substrateId}{note.copied ? `已经亲手抄成${note.id}` : '尚未抄录'}，数量{note.quantity}，已实付{note.paidPennies}便士；{note.status === 'RETURNED' ? '已经归还' : '本人携带'}，当前在{PLACE[note.location]}，剩余{note.charges}次，实际磨损{note.wear}，累计随行{note.travelMetres}米。</p>
          {note.reading && <p>阅读来源：同一原档页，第{note.reading.readingNumber}次实际阅读，发生在现场时钟{note.reading.at}秒。</p>}
          {note.content.length > 0 ? <ul>{note.content.map((fact, index) => <li key={index}>{text(fact)}</li>)}</ul> : <p>尚无本次亲手抄录的内容，不预先生成笔记。</p>}</>
          : <p>本案尚未取得新纸。准备需1行动、20便士，独立购买一张一次纸；须到十米档架亲自阅读后再抄录，不能复制原档页或旧耗材。</p>}
        <p>抄录是同一张纸的转变，原纸与笔记只有一个物件。次数耗尽或撤回许可后仍须归还；换案不恢复次数或磨损。</p>
      </section>
      <section aria-label="知识赋力的实际测量"><h4>只对这一页测量稳定度</h4>
        <p>知识赋力成功后仍须实际应用，消耗同一笔记的一次载荷并留下1点磨损；这一次普通测量的稳定度由3改善到6。判定失败或普通方法仍只记录实际基准3，同样耗尽本次应用。</p>
        {attempt && <p>实际应用{attempt.applicationDone ? '已经完成' : '尚未完成'}；记录基准{attempt.baselineStabilization}，实测稳定度{attempt.measuredStabilization}。没有应用的成功施放不增加掌握。</p>}
      </section>
      <section aria-label="循力求知的实际来源"><h4>先支付真实力量，再核验有限反应</h4>
        <p>先实耗4灵性与同一笔记的一次载荷，以6点短促推力使原页边缘移动1毫米，留下1点磨损。之后循力求知只核验该次位移与阻力线索；核验再留下1点纸张磨损，不恢复力量或次数，缺失正文始终未知。</p>
        {attempt?.forceReceipt ? <p>实际力量凭据{attempt.forceReceipt.id}：在{attempt.forceReceipt.at}秒实耗{attempt.forceReceipt.spiritualitySpent}灵性，经过{attempt.forceReceipt.elapsedSeconds}秒，推力{attempt.forceReceipt.force}，纸缘实际位移{attempt.forceReceipt.paperEdgeMovedMm}毫米，已用{attempt.forceReceipt.noteChargeSpent}次纸张载荷。</p>
          : <p>本案尚无已支付的力量凭据，不能凭空核验一份力量或重复探测。</p>}
        {attempt?.observedReaction && <p>本次实际观察：{text(attempt.observedReaction)}</p>}
        {attempt && <p>本次核验{attempt.verified ? '已经完成' : '尚未完成'}；能力检定实耗{attempt.checkSpiritualitySpent}灵性，原推力另实耗{attempt.forceSpiritualitySpent}灵性，分别记账。</p>}
      </section>
      <section aria-label="实际位置与普通退出"><h4>停止、归物与普通离场</h4>
        {attempt && <><p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.energySpent}本人精力；本人实走{attempt.playerTravelMetres}米，原物主实走{attempt.ownerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.stopped ? '本次方法已经停止。' : '本次尚未明确停止方法。'}{attempt.returned ? '同一纸页已经亲手交还。' : '同一纸页尚未交还。'}{attempt.closed ? '本次接触已经实际结束。' : '仍须完成普通返程和本次交接。'}</p></>}
        <p>室外至门口2米、门口至锚位6米、锚位至档架4米；本人及陪同的原物主各自普通行走并消耗自己的精力。付费室外休息需15便士、1行动、60秒，只恢复本人20现场精力，上限100。</p>
        <p>日常休养、换周和晋升不会免费补满现场精力。停止或关闭页面不替任何人移动，也不退还已付费用、灵性、时间或磨损。</p>
      </section>
      <details className="seer-fold"><summary>三案报告、反思与普通替代</summary><ul>{life.cases.map(entry => <li key={entry.id}>{text(entry.title)}：{STATUS[entry.status] ?? '当前记录'}{entry.result ? `；${text(entry.result)}` : ''}。</li>)}</ul>
        <p>{life.reflected ? '三案报告与反思已保存。' : '本人和原物主均在室外、同一纸页已归还且接触结束后，才可如实报告。每份报告消化25，三案之后反思另消化25；只有实际能力效果在报告时增加相应掌握8。'}</p>
        <ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul><p>{text(life.environment)}</p>
      </details>
    </section>;
  }

  function operationFacts(command: KnowledgeEmperorCommand) {
    switch (command.type) {
      case 'LEARN_GUIDANCE': return <p>支付500便士、1行动，听取独立成品渠道与本阶准备要求。指导不提供完整配方，也不自动获得、准备或饮用药瓶。</p>;
      case 'POTION_WORK': return <p>只为所选独立原瓶完成一次真实劳动，消耗1行动。五项劳动合计抵6000便士，之后仍须另付1200便士取得本瓶。</p>;
      case 'BUY_POTION': return <p>支付本瓶当前列明价格，只领取这一独立成品原瓶。领取不代替专业准备、当周检查或另行确认饮用。</p>;
      case 'REQUEST_SUPPLY': return <p>在本批原瓶全部失败耗尽后，另付100便士、1行动申请下一批三瓶。至少跨一真实周才可接收；每瓶仍须分别劳动或付费取得。</p>;
      case 'PREPARE_PROMOTION': return <p>支付180便士、1行动检查本周服药场地。结束准备不会退还费用；本瓶只有另行确认饮用时才耗尽。</p>;
      case 'LEAVE_PREPARATION': return <p>结束当周准备，保留未服用的独立原瓶；已付检查费不退，下次需重新准备。</p>;
      case 'PREPARE': return <p>本案支付20便士、1行动，在室外交接处购买唯一一张一次新纸。{command.method === 'ORDINARY' ? '选用普通方法，实际测量或核验不增加未应用能力的掌握。' : '准备不施法，仍须真实到档架阅读、抄录和应用。'}原档页及旧耗材不复制；已付费用不因停止或撤回退还。</p>;
      case 'READ_ORIGINAL': return <p>本人须完整实体到达原档架，亲自阅读同一原档页并留下实际阅读记录。只能得到页上现有内容，不能补出缺失正文。</p>;
      case 'COPY_NOTE': return <p>将本案已购买且实际携带的同一张纸亲手抄成笔记，只记录本次已经阅读的有限内容。纸张与笔记只有一个物件，原档页留在原档架。</p>;
      case 'KNOWLEDGE_POWER': return <p>支付8灵性、2精神和1秒，按知识18尝试。成功只为同一原页、同一笔记和当前许可开启20秒一次窗口；实际应用仍会耗用笔记载荷。失败、停止、移动或未应用不返还成本。</p>;
      case 'APPLY_POWER': return <p>对同一原档页进行唯一一次实际稳定度测量，耗尽笔记的一次载荷并留下1点磨损。有效知识赋力将这次基准3改善到6；普通方法或失败仅记录基准3，不重试同一来源。</p>;
      case 'SPEND_FORCE': return <p>先实耗4灵性和同一笔记的一次载荷，以6点短促推力作用于原页，实际经过1秒，使纸缘移动1毫米并留下1点磨损。这份真实支出才可作为循力求知来源，不会返还灵性或纸张次数。</p>;
      case 'POWER_KNOWLEDGE': return <p>须有20秒内同一笔记在同一原页实际付费的推力凭据。另付8灵性、2精神和1秒，按知识18尝试20秒核验窗口；只可核验已有反应，不还原力量、不揭示缺失文字。</p>;
      case 'VERIFY_REACTION': return <p>实际核验原页的位移与阻力线索；有原推力时在同一纸张再留下1点磨损。普通核验或失败同样可完成有限记录，不奖励未发生的能力效果。</p>;
      case 'WAIT_10': return <p>现场实际经过10秒，未用窗口可能到期；停留页面不会自行消耗或延长窗口。已付成本和来源保留，不能重新领取一次尝试。</p>;
      case 'STOP_METHOD': return <p>停止新的能力使用并清除未用窗口，保留所有已付成本。仍须本人及陪同者沿普通路返回，携同一纸页到室外交还。</p>;
      case 'RETURN_TO_A': return <p>本人携实际持有的同一纸页，从档架沿4米普通路返回锚位。本人及陪同者分别经过真实时间、消耗自己的精力，未用窗口失效。</p>;
      case 'RETURN_TO_ENTRY': return <p>本人携同一纸页，从锚位沿6米普通路返回门口。陪同者也须亲自返回，已付代价和磨损保留。</p>;
      case 'LEAVE': return <p>完成核验或明确停止后，从门口沿2米普通路走到室外，陪同者亲自同行。到室外之后仍须亲手归还同一纸页。</p>;
      case 'RETURN_NOTE': return <p>本人和原物主都已实际在室外，将手中同一纸页亲手交还。已耗次数、真实磨损、费用和失败记录保留，交还后才可如实报告。</p>;
      case 'ABORT': return <p>停止本次方法、清除未用窗口，按当前实际距离普通步行返回室外并归还同一纸页。陪同者也真实返回；这不是免费移动或恢复资源，已付代价保留。</p>;
      case 'REPORT': return <p>只报告本案已经发生并实际收尾的结果。本人和原物主须均在室外，纸页已交还；报告消化25，只有本案确实应用的能力增加掌握8，不能重复报告。</p>;
      case 'REFLECT': return <p>在三案已经分别报告后进行一次反思，消化25。普通完成和撤回均如实保留，不补发未发生的能力效果或掌握。</p>;
      case 'RECOVER_ENERGY': return <p>本人在室外支付15便士、1行动，经过60秒恢复20现场精力，上限100。原成人的独立精力、旧伤、灵性、纸张载荷及耗材不会补充。</p>;
      case 'PREPARE_ENCOUNTER': return <p>本场另行支付30便士、1行动，实际取得一张三次战斗笔记。不会补回原卷轴、旧生活纸页或身心资源，也不自动开始交战。</p>;
      case 'ENCOUNTER_TALK': return <p>实际走入独立阅览院交谈，不自动开战。原成年艾瑞丝须已实际在室外；旧梅林与他的身体、原棍及撤退结果仍在旧记录中。</p>;
      case 'LEAVE_ENCOUNTER': return <p>本人沿普通出口实际走4米，经过4秒、消耗2精力。已有伤势、对手独立状态、已耗印记与笔记次数继续保留。</p>;
      default: return null;
    }
  }

  function encounterFacts() {
    const { enemy, note, marks, lastForceReceipt } = encounter;
    const remainingMarks = marks.filter(mark => mark.status === 'HELD').length;
    return <section aria-label="知识皇帝可选真实交战"><h3>{text(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{text(encounter.story)}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他保有独立的身体与意愿，原梅林的经历仍完整保留。</p>
        <section aria-label="战场位置与普通出口"><h4>真实位置与普通退路</h4><p>本人当前在{PLACE[site.playerLocation]}；达里安在{PLACE[enemy.position]}，{site.playerLocation === 'YARD' ? `当前相距${enemy.distanceMetres}米。` : '本人尚未在该交战位置与他接触。'}累计本人实走{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
          <p>{site.iris ? `${site.iris.name}当前在${PLACE[site.iris.location]}，精力${site.iris.energy}/100。` : '尚无原物主当前位置记录。'}原成年人须已实际在室外才能进入本场。生还离场须沿普通出口走4米、经过4秒并消耗2精力，死亡的身体仍留在原处。</p></section>
        <section aria-label="对手原棍与有限印记"><h4>一根原棍，三枚有限印记</h4><p>原棍{enemy.weaponId}{enemy.weaponLocation === 'HAND' ? '仍在达里安手中' : '留在阅览院地面'}。印记剩余{remainingMarks}/{marks.length}枚，已耗尽{marks.length - remainingMarks}枚，不自动补充。</p>
          <p>有限弧光已用{enemy.powerUses.ARC_BOLT}次，有限惊惧印记已用{enemy.powerUses.DREAD_MARK}次，屏护已用{enemy.powerUses.WARD}次，假动作已用{enemy.powerUses.FEINT}次。弧光和惊惧各耗7灵性与一枚印记，分别作用于身体和精神；屏护耗4灵性，假动作耗3灵性。</p>
          {lastForceReceipt ? <p>最近实际力量凭据{lastForceReceipt.id}：对手在{lastForceReceipt.atSeconds}秒实际施加{lastForceReceipt.kind === 'BODY' ? '身体' : '精神'}力量，已耗{lastForceReceipt.paidCost}灵性及同一枚印记。只有仍可见、条件相符且20秒内的这一真实来源才能用于循力求知。</p>
            : <p>尚无对手实际消耗力量的凭据，不能从他的名字或未来意图取得循力求知帮助。</p>}
        </section></>}
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4><p>当前策略：{POLICIES[encounter.policy]}。开战前可以改变；选择策略不施法、不购买物品、不自动开战。</p></section>
      <section aria-label="知识皇帝战斗笔记"><h4>本场单独付费的三次笔记</h4>
        {note ? <p>本场笔记{note.id}：已实付{note.paidPennies}便士，当前由本人持有，剩余{note.charges}/{note.initialCharges}次，实际磨损{note.wear}。</p>
          : <p>本场笔记尚未实际取得，须另付30便士、1行动取得一张三次笔记。它不替代或补满旧卷轴和生活纸页。</p>}
        <p>知识赋力只有在下一次真实普通攻击应用时才消耗同一笔记一次、增加1点磨损；窗口失败、到期或未应用不退施法成本，也不凭空增加掌握。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>一次真实作用的有限帮助</h4><p>知识赋力为20秒内同位置、同一可见对手的下一次真实普通攻击增加35，只能应用一次。循力求知须先有对手20秒内实际力量支出的可见凭据，只减轻随后下一次同类真实冲击30。</p>
        <p>每次施放消耗8灵性、2精神和5秒，按知识18检定。移动、遮挡、假动作、撤回或到期会清除未用窗口；不会预知隐蔽意图，不提供普遍免伤，也不还原已支付的力量。</p><p>{text(value.inheritedTools)}</p></section>
      <details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{text(fact)}</li>)}</ul></details>
    </section>;
  }
}
