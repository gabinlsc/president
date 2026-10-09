import type { GameEngine } from './GameEngine';
export type BotAction =
  { type: 'play'; cards: string[] } | { type: 'pass' } | { type: 'exchange'; cards: string[] };
export function chooseBotAction(game: GameEngine, id: string): BotAction | null {
  const s = game.state,
    p = game.player(id);
  if (s.phase === 'exchange') {
    const count = game.exchangeCount(id);
    if (!count || s.exchanges[id]) return null;
    // Give low cards, retain coherent groups where values are close.
    return {
      type: 'exchange',
      cards: [...p.hand]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, count)
        .map((c) => c.id),
    };
  }
  if (s.phase !== 'playing' || !p.hand.length) return null;
  const moves = game.legalMoves(id);
  if (s.turn !== id) {
    const cut = moves.find(
      (ids) => game.isCut(id, ids) && (ids.length >= 2 || ids.length === p.hand.length),
    );
    return cut ? { type: 'play', cards: cut } : null;
  }
  if (!moves.length) return { type: 'pass' };
  const score = (ids: string[]) => {
    const rank = p.hand.find((c) => c.id === ids[0])!.rank;
    const group = p.hand.filter((c) => c.rank === rank).length;
    if (ids.length === p.hand.length) return rank === 15 ? 1000 : -1000;
    return (
      rank * 3 -
      ids.length * 8 +
      (group > ids.length ? 12 : 0) -
      (game.isCut(id, ids) ? 18 : 0) +
      (rank === 15 ? 20 : 0)
    );
  };
  const best = [...moves].sort((a, b) => score(a) - score(b))[0]!;
  const rank = p.hand.find((c) => c.id === best[0])!.rank;
  if (
    s.table &&
    !s.table.equalRequired &&
    rank >= 14 &&
    best.length < p.hand.length &&
    s.players.filter((x) => x.hand.length > 0 && x.id !== id).every((x) => x.hand.length > 3)
  )
    return { type: 'pass' };
  return { type: 'play', cards: best };
}
export function applyBotAction(game: GameEngine, id: string, action: BotAction): void {
  if (action.type === 'play') game.play(id, action.cards);
  else if (action.type === 'pass') game.pass(id);
  else game.exchange(id, action.cards);
}
