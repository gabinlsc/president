import { appendFile } from 'node:fs/promises';
import type { Role, RoomMode } from '@president/shared';

/** One player at the end of a round, best place first. Humans who were away at the end are not listed. */
export interface ResultPlayer {
  readonly name: string;
  readonly bot: boolean;
  /** 1 = président, then each place down to the trou du cul. */
  readonly rank: number;
  readonly won: boolean;
  readonly role: Role;
  /** Ended the round on a 2 (sent to the last places). */
  readonly penalized: boolean;
}

/**
 * A finished round (a game of Président never ends: each round is one result), as written to
 * RESULTS_FILE, one JSON object per line. Read by the glsc.fr probe for the games.glsc.fr leaderboard.
 */
export interface RoundRecord {
  readonly v: 1;
  /** Unix time, seconds. */
  readonly t: number;
  readonly game: 'president';
  readonly mode: RoomMode;
  readonly round: number;
  readonly players: readonly ResultPlayer[];
}

export type ResultSink = (record: RoundRecord) => void;

/** Appends each record to `file`, in order. A write error is logged and never reaches the game. */
export function fileResultSink(
  file: string,
  log: (message: string) => void = console.error,
): ResultSink {
  let queue: Promise<void> = Promise.resolve();
  return (record) => {
    const line = `${JSON.stringify(record)}\n`;
    queue = queue
      .then(() => appendFile(file, line, { mode: 0o640 }))
      .catch((e: unknown) =>
        log(`[président] résultat non enregistré : ${e instanceof Error ? e.message : String(e)}`),
      );
  };
}
