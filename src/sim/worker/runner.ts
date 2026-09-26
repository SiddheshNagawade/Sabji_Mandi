// Stateful simulation runner behind the worker protocol (SPEC.md section
// 9.11). Kept free of `self`/`postMessage` so it can run identically inside
// the UI worker, a batch worker, or a plain Vitest test — only the `post`
// callback and the timer functions are environment-provided.

import type { Project } from '../../data/schema';
import { World } from '../core/world';
import { isRunComplete, step } from '../core/tick';
import { BUYER_STATE_CODE } from './protocol';
import type { DoneMessage, FrameMessage, HeatMessage, MetricsMessage, WorkerCommand, WorkerMessage } from './protocol';

const FRAME_MS = 1000 / 30;
const HEAT_MS = 1000 / 5;

export class SimRunner {
  private post: (msg: WorkerMessage) => void;
  private world: World | null = null;
  private project: Project | null = null;
  private seed = 1;
  private speedMultiplier = 1;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHeatAt = 0;
  private frameCount = 0;

  constructor(post: (msg: WorkerMessage) => void) {
    this.post = post;
  }

  handle(cmd: WorkerCommand) {
    try {
      switch (cmd.type) {
        case 'init':
          this.project = cmd.project;
          this.seed = cmd.seed;
          this.world = new World(cmd.project, cmd.seed);
          this.postMetrics();
          break;
        case 'run':
          this.start();
          break;
        case 'pause':
          this.stop();
          break;
        case 'setSpeed':
          this.speedMultiplier = Math.max(0, cmd.multiplier);
          break;
        case 'reset':
          this.stop();
          if (this.project) this.world = new World(this.project, this.seed);
          this.postMetrics();
          break;
        case 'seek':
          // Scrub-bar seeking needs trajectory recording, added with the
          // Simulate screen's playback controls (M3). Ignored for now.
          break;
        case 'getStats':
          this.postMetrics();
          break;
      }
    } catch (err) {
      this.post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  private start() {
    if (this.intervalId != null || !this.world) return;
    this.intervalId = setInterval(() => this.tick(), FRAME_MS);
  }

  private stop() {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    const world = this.world;
    if (!world) return;
    const ticksPerFrame = Math.max(1, Math.round((this.speedMultiplier * (FRAME_MS / 1000)) / world.dt));
    for (let i = 0; i < ticksPerFrame; i++) {
      step(world);
      if (isRunComplete(world)) {
        this.stop();
        this.postFrame();
        this.postHeat();
        this.postDone();
        return;
      }
    }
    this.postFrame();
    this.frameCount++;
    const now = this.frameCount * FRAME_MS;
    if (now - this.lastHeatAt >= HEAT_MS) {
      this.lastHeatAt = now;
      this.postHeat();
    }
    this.postMetrics();
  }

  private postFrame() {
    const world = this.world;
    if (!world) return;
    const agents = Array.from(world.agents.values());
    const positions = new Float32Array(agents.length * 4);
    const agentIds = new Int32Array(agents.length);
    agents.forEach((a, i) => {
      positions[i * 4] = a.x;
      positions[i * 4 + 1] = a.y;
      positions[i * 4 + 2] = BUYER_STATE_CODE[a.state] ?? -1;
      positions[i * 4 + 3] = a.blockedTicks > 0 ? 1 : 0;
      agentIds[i] = a.id;
    });
    const msg: FrameMessage = { type: 'frame', t: world.t, positions, agentIds };
    this.post(msg);
  }

  private postHeat() {
    const world = this.world;
    if (!world) return;
    const msg: HeatMessage = {
      type: 'heat',
      occupancySeconds: world.heat.occupancySeconds.slice(),
      passCount: world.heat.passCount.slice(),
      stuckSeconds: world.heat.stuckSeconds.slice(),
    };
    this.post(msg);
  }

  private metricsSnapshot(): MetricsMessage {
    const world = this.world!;
    return {
      type: 'metrics',
      t: world.t,
      peopleInMarket: world.agents.size,
      spawned: world.metrics.spawned,
      despawned: world.metrics.despawned,
      skippedQueue: world.metrics.skipped.queue,
      skippedBlocked: world.metrics.skipped.blocked,
    };
  }

  private postMetrics() {
    if (!this.world) return;
    this.post(this.metricsSnapshot());
  }

  private postDone() {
    if (!this.world) return;
    const msg: DoneMessage = { type: 'done', finalMetrics: this.metricsSnapshot(), timesInMarket: this.world.metrics.timesInMarket.slice() };
    this.post(msg);
  }
}
