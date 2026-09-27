import { useSimStore } from '../../app/simStore';
import type { AgentDetail, CellDetail, StallDetail, VehicleDetail } from '../../sim/worker/protocol';
import { BUYER_STATE_NAME, BUYER_STATE_CODE, VEHICLE_STATE_NAME, VEHICLE_STATE_CODE } from '../../sim/worker/protocol';

export function InspectPanel() {
  const inspect = useSimStore((s) => s.inspect);
  const clearInspect = useSimStore((s) => s.clearInspect);

  if (!inspect) {
    return <div className="p-2 text-xs text-neutral-400">Click a person, a stall or a cell on the map to inspect it.</div>;
  }

  return (
    <div className="space-y-1 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold capitalize">{inspect.kind}</span>
        <button className="text-neutral-400 hover:text-neutral-700" onClick={clearInspect}>
          ✕
        </button>
      </div>
      {!inspect.detail && <p className="text-neutral-400">Loading…</p>}
      {inspect.kind === 'agent' && inspect.detail && <AgentInfo detail={inspect.detail as AgentDetail} />}
      {inspect.kind === 'stall' && inspect.detail && <StallInfo detail={inspect.detail as StallDetail} />}
      {inspect.kind === 'cell' && inspect.detail && <CellInfo detail={inspect.detail as CellDetail} />}
      {inspect.kind === 'vehicle' && inspect.detail && <VehicleInfo detail={inspect.detail as VehicleDetail} />}
    </div>
  );
}

function AgentInfo({ detail }: { detail: AgentDetail }) {
  const stateName = BUYER_STATE_NAME[BUYER_STATE_CODE[detail.state] ?? 0] ?? detail.state;
  return (
    <div className="space-y-1">
      <div>Buyer #{detail.id}</div>
      <div>
        Type: {detail.buyerTypeId} · {stateName}
      </div>
      <div>
        List progress: {detail.listIndex}/{detail.list.length} ({detail.list.join(', ') || '—'})
      </div>
      <div>Speed: {detail.speedMps.toFixed(2)} m/s</div>
      <div>Obeys arrows: {detail.obeysArrows ? 'yes' : 'no'}</div>
      <div>Time in market: {detail.timeInMarketS.toFixed(0)} s</div>
      <div>Blocked ticks (current): {detail.blockedTicks}</div>
      {detail.state === 'WAIT_FOR_SLOT' && <div>Waiting: {detail.waitElapsedS.toFixed(0)} s</div>}
      {detail.state === 'BEING_SERVED' && <div>Service remaining: {detail.serviceRemainingS.toFixed(0)} s</div>}
      {detail.lastSkipReason && <div>Last skip reason: {detail.lastSkipReason}</div>}
    </div>
  );
}

function StallInfo({ detail }: { detail: StallDetail }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{detail.label ?? `Stall ${detail.id}`}</div>
      <div>
        Produce: {detail.produce.join(', ')} · {detail.sellerType}
      </div>
      <div>Footfall (visits): {detail.visits}</div>
      <div>Served: {detail.servedCount}</div>
      <div>
        Currently: {detail.currentlyServed}/{detail.slots} being served, {detail.currentlyWaiting} waiting
      </div>
      <div>
        Lost visits: {detail.lostVisitsQueue} (queue), {detail.lostVisitsBlocked} (blocked)
      </div>
    </div>
  );
}

function VehicleInfo({ detail }: { detail: VehicleDetail }) {
  const stateName = VEHICLE_STATE_NAME[VEHICLE_STATE_CODE[detail.state] ?? 0] ?? detail.state;
  return (
    <div className="space-y-1">
      <div>
        Vehicle #{detail.id} · {detail.vehicleType.replace('_', ' ')}
      </div>
      <div>State: {stateName}</div>
      <div>Time in market: {detail.timeInMarketS.toFixed(0)} s</div>
      {detail.state === 'DWELL' && <div>Dwell remaining: {detail.dwellRemainingS.toFixed(0)} s</div>}
      {detail.targetBayId != null && <div>Target bay: #{detail.targetBayId}</div>}
      {detail.failedUnload && <div className="text-amber-700">Failed to unload — never found a free bay in time.</div>}
    </div>
  );
}

function CellInfo({ detail }: { detail: CellDetail }) {
  return (
    <div className="space-y-1">
      <div>
        Cell ({detail.x}, {detail.y})
      </div>
      <div>Occupancy: {detail.occupancySeconds.toFixed(1)} person-seconds</div>
      <div>Pass count (footfall): {detail.passCount}</div>
      <div>Stuck time: {detail.stuckSeconds.toFixed(1)} s</div>
      <div>Currently occupied: {detail.currentOccupantAgentId != null ? `buyer #${detail.currentOccupantAgentId}` : 'no'}</div>
    </div>
  );
}
