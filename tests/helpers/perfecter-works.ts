import { advancePerfecterWorks, applyPerfecterWorks, createPerfecterWorks, WORKS_LOCATIONS, type PerfecterWorksCommand } from '../../src/domain/perfecter/works.js';
import { PERFECTER_WORKS_STATION_IDS } from '../../src/domain/perfecter/works-content.js';
import type { PerfecterHost } from '../../src/domain/perfecter/ports.js';
export function perfecterWorksRunner() {
  let state = createPerfecterWorks('finite-civic-works', 188);
  let host: PerfecterHost = { eventId: 'works-1', revision: 800, week: 188, actorId: 'original-player', location: WORKS_LOCATIONS.ARCHIVE,
    sequence: 1, status: 'ACTIVE', cash: 436, actions: 3, health: 100, mind: 100, spirituality: 120, check: null };
  let counter = 1;
  const wait = (week: number) => { state = advancePerfecterWorks(state, week); host = { ...host, week, actions: 3 }; };
  const step = (command: PerfecterWorksCommand) => {
    if (host.actions === 0) wait(host.week + 1);
    const result = applyPerfecterWorks(state, command, host); state = result.state;
    host = { ...host, revision: host.revision + 1, eventId: `works-${++counter}`,
      cash: host.cash - result.effect.cashCost + result.effect.cashGain, actions: host.actions - result.effect.actions,
      location: result.effect.toLocation ?? host.location };
    return result;
  };
  const travel = (stationId: typeof PERFECTER_WORKS_STATION_IDS[number]) => { if (host.location !== WORKS_LOCATIONS[stationId]) step({ type: 'WORKS_TRAVEL', stationId }); };
  const prepare = () => {
    for (const stationId of PERFECTER_WORKS_STATION_IDS) {
      travel(stationId);
      for (const type of ['WORKS_INSPECT', 'WORKS_BUY_PARTS', 'WORKS_REPAIR', 'WORKS_CALIBRATE', 'WORKS_TRIAL'] as const) step({ type, stationId });
    }
  };
  const complete = () => {
    prepare(); wait(Math.max(host.week, ...state.stations.map(st => st.trialWeek! + 2)));
    for (const stationId of PERFECTER_WORKS_STATION_IDS) { travel(stationId); step({ type: 'WORKS_VERIFY', stationId }); }
  };
  return { get state() { return state; }, get host() { return host; }, step, wait, travel, prepare, complete };
}
