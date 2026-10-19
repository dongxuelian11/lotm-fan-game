import { useEffect, useId, useRef, useState } from 'react';
import type { AttendantMysteriesAction, AttendantMysteriesCommand, AttendantMysteriesProjection } from '../domain/attendant-mysteries/types';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

type Page = 'town' | 'materials' | 'life' | 'encounter';
const PAGES: { id: Page; label: string }[] = [{ id: 'town', label: '城镇' }, { id: 'materials', label: '材料与魔药' }, { id: 'life', label: '实践' }, { id: 'encounter', label: '交涉' }];
const RECEPTION = new Set(['RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK']);
const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'MATERIAL_WORK', 'BUY_MATERIALS', 'BREW', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const CASE_STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '进行中', EXAMINED: '待报告', RESOLVED: '已收束' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface AttendantMysteriesPanelProps {
  value: AttendantMysteriesProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: AttendantMysteriesCommand) => void;
  onClose?: () => void;
}

/** UI selections only filter saved domain actions; they never create commands or resources. */
export function AttendantMysteriesPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: AttendantMysteriesPanelProps) {
  const [page, setPage] = useState<Page>('town');
  const [townTarget, setTownTarget] = useState('overview');
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [alternativeId, setAlternativeId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: AttendantMysteriesAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const id = useId();
  const facts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || pending || value.resources?.health === 0;
  const controlsLocked = locked || confirmation !== null;
  const { town, life, encounter } = value;
  const activePage = encounter.inside ? 'encounter' : life.insideCase ? 'life' : page;
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.id === caseId) ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const townActions = value.actions.filter(action => action.command.type === 'TOWN');
  const townPreferred = townActions.find(action => action.id === town.preferredActionId)
    ?? townActions.find(action => action.id === value.preferredActionId);
  const siteOptions = new Map<string, string>();
  for (const action of townActions) {
    const command = action.command;
    if (command.type !== 'TOWN') continue;
    const local = command.command;
    const site = 'siteId' in local ? local.siteId : 'plotId' in local ? local.plotId : 'to' in local ? local.to : 'sourceId' in local ? local.sourceId : null;
    if (site !== null && !siteOptions.has(site)) siteOptions.set(site, action.label);
  }
  const validTargets = new Set(['overview', ...town.residents.map(resident => `resident:${resident.id}`), ...town.facilities.map(facility => `facility:${facility.id}`), ...town.visitors.map(visitor => `visitor:${visitor.id}`), ...Array.from(siteOptions.keys(), site => `site:${site}`)]);
  const selectedTarget = validTargets.has(townTarget) ? townTarget : 'overview';
  const lifeActionIds = new Set(life.actions.map(action => action.id));
  const encounterActionIds = new Set(encounter.actions.map(action => action.id));
  const entries = value.actions.filter(action => {
    const command = action.command;
    if ((activePage === 'town' || activePage === 'materials') && RECEPTION.has(command.type)) return true;
    if (activePage === 'materials') return ACQUISITION.has(command.type) && (!('bottleId' in command) || command.bottleId === selectedBottle?.id);
    if (activePage === 'life') return lifeActionIds.has(action.id) && (!('caseId' in command) || command.caseId === selectedCase?.id);
    if (activePage === 'encounter') return encounterActionIds.has(action.id);
    if (command.type !== 'TOWN') return selectedTarget === 'overview' && action.id === value.preferredActionId && ACQUISITION.has(command.type);
    const local = command.command;
    if (selectedTarget === 'overview') return action.id === townPreferred?.id || !('originalId' in local || 'facilityId' in local || 'visitorId' in local);
    if (selectedTarget.startsWith('resident:')) return 'originalId' in local && selectedTarget === `resident:${local.originalId}`;
    if (selectedTarget.startsWith('facility:')) return 'facilityId' in local && selectedTarget === `facility:${local.facilityId}`;
    if (selectedTarget.startsWith('visitor:')) return 'visitorId' in local && selectedTarget === `visitor:${local.visitorId}`;
    return ('siteId' in local && selectedTarget === `site:${local.siteId}`)
      || ('plotId' in local && selectedTarget === `site:${local.plotId}`)
      || ('to' in local && selectedTarget === `site:${local.to}`)
      || ('sourceId' in local && selectedTarget === `site:${local.sourceId}`);
  });
  const preferredId = activePage === 'town' ? town.preferredActionId : activePage === 'life' ? life.preferredActionId : value.preferredActionId;
  const next = entries.find(action => action.enabled && action.id === preferredId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup)
    ?? entries.find(action => action.enabled) ?? entries.find(action => action.id === preferredId) ?? entries[0];
  const alternatives = entries.filter(action => action.id !== next?.id);
  const alternative = alternatives.find(action => action.id === alternativeId) ?? alternatives.find(action => action.enabled) ?? alternatives[0];
  const cleanupAvailable = entries.some(action => action.enabled && action.cleanup);
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmedTown = live?.command.type === 'TOWN' ? live.command.command : null;
  const originalId = confirmedTown && 'originalId' in confirmedTown ? confirmedTown.originalId : null;
  const original = town.residents.find(resident => resident.id === originalId);
  const confirmedBottleId = live?.command.type === 'CONSUME' ? live.command.bottleId : null;
  const confirmedBottle = value.bottles.find(bottle => bottle.id === confirmedBottleId);
  const identityMissing = !!live && ((live.command.type === 'CONSUME' && !confirmedBottle)
    || ((confirmedTown?.type === 'CONVERT' || confirmedTown?.type === 'END_CONTROL') && !original));
  const phase = `${activePage}:${selectedTarget}:${selectedCase?.id}:${selectedBottle?.id}:${next?.id}`;

  useEffect(() => { if (!confirmation && !pending) heading.current?.focus(); }, [phase]);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null;
      submittedFacts.current = null;
      setPending(false);
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    } else if (error !== null || confirmation && confirmation.facts !== facts) {
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation]);

  function choose(action: AttendantMysteriesAction) {
    if (controlsLocked || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit() {
    if (locked || submitted.current !== null || !live?.enabled || identityMissing) return;
    submitted.current = live.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(live.command);
  }
  function actionControl(action: AttendantMysteriesAction) {
    return <div className="seer-action" key={action.id}>
      <button className="slice-choice" disabled={controlsLocked || !action.enabled}
        ref={node => { if (node) buttons.current.set(action.id, node); else buttons.current.delete(action.id); }}
        aria-describedby={action.reason ? `${id}-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`${id}-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="诡秘侍者成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原人、原身体与原物记录只读保留。' : next?.label ?? (activePage === 'town' ? town.nextStep : activePage === 'life' ? life.nextStep : value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {value.resources && <section aria-label="诡秘侍者当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{value.resources.health}/{value.resources.maxHealth} · 精神{value.resources.mind}/{value.resources.maxMind} · 灵性{value.resources.spirituality}/{value.resources.maxSpirituality} · 排异{value.pollution}</p>
      <p>{value.resources.cash} · 本周行动{value.resources.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul aria-label="当前伤势与处置">{value.injuries.map((injury, index) => <li key={injury.id}>第{index + 1}处{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已实际处置，仍须休养' : '尚未处置'}</li>)}</ul>}
      <p>原伤继续生效；晋升、停止能力与收尾不会补满健康、精神或灵性。</p>
    </section>}
    {!inside && onClose && <button className="slice-button quiet" disabled={controlsLocked} onClick={() => { if (!controlsLocked) onClose(); }}>返回普通生活</button>}
    <nav aria-label="诡秘侍者页面" className="clown-growth-tabs ordinary-growth-tabs">
      {PAGES.map(entry => <button key={entry.id} className="slice-button quiet" disabled={controlsLocked || (life.insideCase || encounter.inside) && activePage !== entry.id} aria-pressed={activePage === entry.id} onClick={() => setPage(entry.id)}>{entry.label}</button>)}
    </nav>

    {activePage === 'town' && <section aria-label="新城镇总览">
      <h3>{town.title}</h3><p>{town.summary}</p><p>本人位置：{town.location}</p>
      <p>灵界区域：{town.region} · {town.ready ? '当前仪式条件已满足' : '当前仪式条件尚未满足'}</p>
      <ul aria-label="当前城镇要求">{town.requirements.map((requirement, index) => <li key={index}>{requirement.complete ? '已满足' : '尚未满足'} · {requirement.label}{requirement.detail !== requirement.label ? `：${requirement.detail}` : ''}</li>)}</ul>
      <label className="seer-case-selector">当前城镇对象
        <select disabled={controlsLocked} value={selectedTarget} onChange={event => setTownTarget(event.target.value)}>
          <option value="overview">全镇进度</option>
          <optgroup label="居民原身体">{town.residents.map(resident => <option key={resident.id} value={`resident:${resident.id}`}>{resident.name} · {resident.status}</option>)}</optgroup>
          <optgroup label="实际设施">{town.facilities.map(facility => <option key={facility.id} value={`facility:${facility.id}`}>{facility.label}</option>)}</optgroup>
          <optgroup label="已列出的现场与路线">{Array.from(siteOptions, ([site, label]) => <option key={site} value={`site:${site}`}>{label}</option>)}</optgroup>
          <optgroup label="自主来访者">{town.visitors.map(visitor => <option key={visitor.id} value={`visitor:${visitor.id}`}>{visitor.label}</option>)}</optgroup>
        </select>
      </label>
      <p>选择对象只查看该对象的操作，不会移动、控制或分配任何原人原物。</p>
    </section>}

    {activePage === 'materials' && <section aria-label="诡秘侍者材料与魔药">
      <h3>材料、配制与独立原瓶</h3><p>{value.supplies}</p>
      <p>{value.formulaKnown ? '已掌握本批配方。' : '当前尚未掌握配方。'}可以不服药并继续停留奇迹师。</p>
      {value.formulaKnown && <ul className="seer-formula">{value.formula.map((material, index) => <li key={index}><span>{material.name} · {material.quantity}{material.unit}{material.note ? ` · ${material.note}` : ''}</span></li>)}</ul>}
      {value.bottles.length > 0 && <label className="seer-case-selector">当前原药瓶<select disabled={controlsLocked} value={selectedBottle?.id ?? ''} onChange={event => setBottleId(event.target.value)}>{value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}</select></label>}
      {selectedBottle && <section aria-label="独立原药瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>{selectedBottle.source}</p><p>当前成功率{selectedBottle.chance}%</p></section>}
      <p>{value.risk}</p>
    </section>}

    {activePage === 'life' && <section aria-label="诡秘侍者实践现场">
      <h3>{life.title}</h3><p>{life.story}</p><p>{life.environment}</p>
      {life.cases.length > 0 && <label className="seer-case-selector">当前实践<select disabled={controlsLocked || life.insideCase} value={selectedCase?.id ?? ''} onChange={event => setCaseId(event.target.value)}>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>}
      {selectedCase && <><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>{selectedCase.result && <p>{selectedCase.result}</p>}</>}
      <p>本人累计实际步行{life.playerTravelMetres}米，现场时钟{life.clockSeconds}秒；本次有限作用剩余{life.effectRemainingSeconds}秒。停留在页面上不会代为等待或停止。</p>
      <p>{life.nextStep}</p><ul>{life.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </section>}

    {activePage === 'encounter' && <section aria-label="诡秘侍者交涉现场">
      <h3>{encounter.title}</h3><p>{encounter.story}</p>
      <section aria-label="对方的独立身体与心智"><h4>{encounter.enemy.name} · {encounter.enemy.age}岁 · 序列{encounter.enemy.sequence}</h4><p>健康{encounter.enemy.health} · 精神{encounter.enemy.mind} · 灵性{encounter.enemy.spirituality} · {ENEMY_STATUS[encounter.enemy.status] ?? encounter.enemy.status}</p><p>原身份：{encounter.enemy.id}。镇中居民实际参战{encounter.scene.residentsJoined}位；原居民的身体与去向仍按城镇记录保留。</p></section>
      <p>本人累计实际步行{encounter.scene.playerTravelMetres}米，现场时钟{encounter.scene.clockSeconds}秒。</p>
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </section>}

    {value.resources?.actionsRemaining === 0 && cleanupAvailable && <p className="slice-notice">本周行动已用尽，仍有可执行的普通收尾。每项的灵性、精神、时间与物资消耗仍按所示费用结算。</p>}
    {next ? <section aria-label="当前主要操作"><h3>{next.cleanup ? '普通收尾与退出' : '当前操作'}</h3>{actionControl(next)}</section> : <p>当前对象没有已列出的操作，请查看城镇要求或选择其他对象。</p>}
    {alternative && <details className="seer-fold"><summary>其他操作、普通替代与退出（{alternatives.length}项）</summary>
      <label className="seer-case-selector">其他操作<select disabled={controlsLocked} value={alternative.id} onChange={event => setAlternativeId(event.target.value)}>{alternatives.map(action => <option key={action.id} value={action.id}>{action.label}{action.enabled ? '' : ' · 当前不可用'}</option>)}</select></label>
      {actionControl(alternative)}
    </details>}

    {activePage === 'town' && <>
      <details className="seer-fold"><summary>居民与原身体（{town.residents.length}位）</summary>
        <p>生物生命与秘偶控制分开记录。已转化的原生物已经死亡；同一原身体仍受控制，不表示复活。</p>
        <div style={{ overflowX: 'auto' }}><table><caption>居民生命、控制与原身体</caption><thead><tr><th scope="col">居民及来源</th><th scope="col">原身份</th><th scope="col">生命与控制</th><th scope="col">当前去向</th><th scope="col">经历</th></tr></thead><tbody>
          {town.residents.map(resident => <tr key={resident.id}><th scope="row">{resident.name}<br />{resident.source}</th><td>原生物：{resident.id}<br />原身体：{resident.bodyId}</td><td>{resident.alive ? '原生物仍活' : '原生物已死亡'}<br />{resident.status}<br />{resident.worm}</td><td>{resident.location}<br />{resident.facility}</td><td>命运记录{resident.fateCount}项</td></tr>)}
        </tbody></table></div>
      </details>
      <details className="seer-fold"><summary>实际设施（{town.facilities.length}处）</summary><ul>{town.facilities.map(facility => <li key={facility.id}>{facility.label} · {facility.built ? '已建成' : '尚未建成'} · 在岗{facility.staffed} · 状况{facility.condition} · 实际产出{facility.output}</li>)}</ul></details>
      <details className="seer-fold"><summary>自主来访者与往来</summary><p>这些来访者是仍活、有自主意志的成年人，保留拒绝与离开的权利，不属于秘偶居民。</p>
        <ul>{town.visitors.map(visitor => <li key={visitor.id}>{visitor.label} · 原身份{visitor.id} · {visitor.location} · {visitor.consent} · 已完成往来{visitor.completed}次</li>)}</ul>
        <ul>{town.ledger.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>
    </>}
    <details className="seer-fold"><summary>能力、消化与继承经历</summary><p>{value.digestion}</p><p>当前消化{value.acting}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>{value.abilities.map(ability => <section key={ability.id}><h3>{playerText(ability.label)} · 掌握{ability.mastery}</h3><p>{playerText(ability.description)}</p></section>)}</details>
    <details className="seer-fold"><summary>城镇条件与能力边界</summary><p>{value.story}</p><p>{value.boundary}</p><p>{value.environment}</p><p>关闭页面不会代为停止控制、收回灵之虫、交还原物或实际离场；原死亡、旧联系与已付代价继续保留。</p></details>

    {confirmation && <section role="dialog" aria-modal="true" aria-label="诡秘侍者操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live?.label ?? '现场已变化'}</h3>
      {live && <p>本次实际费用：{live.cost}</p>}
      {original && <section aria-label="本次操作的原生物与原身体"><h4>{original.name}</h4><p>原生物：{original.id} · 原身体：{original.bodyId}</p><p>{original.source} · {original.alive ? '原生物仍活' : '原生物已死亡'} · {original.status} · {original.location}</p><p>当前灵之虫：{original.worm} · 当前设施：{original.facility}</p></section>}
      {confirmedTown?.type === 'CONVERT' && <p>继续转化将使这一原生物不可逆死亡。随后操纵的是同一原身体，原生物不会仍活；停止控制、收回灵之虫或离开都不能复活它。取消不会提交转化。</p>}
      {confirmedTown?.type === 'END_CONTROL' && <p>{original?.alive ? '原生物当前仍活，终止初步控制会放开它；这不是转化操作。' : '原生物已经死亡。终止控制后，同一原身体将失去控制，原生命不会恢复。'}尚未收回的已分出灵之虫会失去；本次损失按上述实际费用保留，取消不会终止控制。</p>}
      {confirmedTown?.type === 'MOVE_TOWN' && <section aria-label="迁址的旧联系后果"><h4>确认迁址与旧联系失效</h4><p>当前城镇：{town.location} · 迁往地块：{confirmedTown.plotId}</p><p>当前灵界区域：{town.region}</p><p>迁址成功后，旧往来与旧灵界区域不再用于本次仪式，须在新址重新建立联系。原死者、旧区域、已花物资与费用继续保留；搬运失败也会实际付费，并可能留下设施损伤。</p><ul>{town.visitors.map(visitor => <li key={visitor.id}>{visitor.label} · {visitor.consent} · 已完成往来{visitor.completed}次</li>)}</ul><ul>{town.ledger.map((entry, index) => <li key={index}>{entry}</li>)}</ul></section>}
      {confirmedTown?.type === 'START_PHASE' && <p>开始新阶段会放弃当前阶段尚未完成的事件。旧死亡、支出与经历保留；只提交这里列出的当前阶段操作。</p>}
      {confirmedBottle && <section aria-label="本次确认的原药瓶"><h4>{confirmedBottle.title}</h4><p>原瓶：{confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%</p><p>{value.risk}</p><p>成功与失败均实际耗尽这一原瓶及本次准备；失败保留已付代价。取消不会服药，也可继续停留奇迹师。</p></section>}
      {live?.command.type !== 'CONSUME' && <p>{activePage === 'town' ? value.boundary : activePage === 'materials' ? value.risk : activePage === 'life' ? life.environment : encounter.story}</p>}
      {live?.reason && <p>{live.reason}</p>}
      {identityMissing && <p role="alert">无法从当前已保存记录核对本次原生物或原瓶，不能提交。请取消后重新读取现场。</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled || identityMissing} onClick={submit}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : confirmedTown?.type === 'CONVERT' ? '确认原生物死亡并转化' : confirmedTown?.type === 'END_CONTROL' ? '确认终止这一次控制' : confirmedTown?.type === 'MOVE_TOWN' ? '确认迁址并使旧联系失效' : '确认执行这一次操作'}</button></div>
      <p>仅在确认后提交这一次操作。取消不会新增费用，也不退还先前已经实际支付的代价。</p>
    </section>}
  </section>;
}
