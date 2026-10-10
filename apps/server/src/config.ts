import { randomInt } from 'node:crypto';

export interface Pacing {
  /** Time given to clients to animate a deal before play or exchanges begin. */
  readonly dealDelay: number;
  /** Base thinking time of a bot (or of a bot standing in for a disconnected player). */
  readonly botDelay: number;
  /** Extra pause after a trick is cleared so everyone sees the winning cards. */
  readonly clearPause: number;
}

export interface ServerOptions {
  readonly origins: readonly string[];
  readonly staticDir: string | null;
  readonly pacing: Pacing;
  /** Seed source for deals; injectable for deterministic tests. */
  readonly seed: () => number;
  /** Rooms without any connected human are removed after this idle time. */
  readonly roomTtl: number;
}

const DEFAULT_ORIGINS =
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001';

const nonNegative = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const DEFAULT_PACING: Pacing = { dealDelay: 1600, botDelay: 900, clearPause: 1100 };

export function resolveOptions(overrides: Partial<ServerOptions> = {}): ServerOptions {
  const env = process.env;
  return {
    origins: (env.CLIENT_ORIGIN ?? DEFAULT_ORIGINS).split(',').map((s) => s.trim()),
    staticDir: env.STATIC_DIR ?? null,
    pacing: {
      dealDelay: nonNegative(env.DEAL_DELAY, DEFAULT_PACING.dealDelay),
      botDelay: nonNegative(env.BOT_DELAY, DEFAULT_PACING.botDelay),
      clearPause: nonNegative(env.CLEAR_PAUSE, DEFAULT_PACING.clearPause),
    },
    seed: () => randomInt(0, 2 ** 32),
    roomTtl: 30 * 60 * 1000,
    ...overrides,
  };
}
