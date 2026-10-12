// The Lichess puzzle of the day (https://lichess.org/api/puzzle/daily): the
// game it comes from in SAN, the ply it starts after, and the solution in UCI.

import { applyUci, parseFen, toFen } from './chess.ts'
import { fromSan, toSan } from './moves.ts'
import type { DailyPuzzle } from '../types'
import type { Level } from './puzzles.ts'

export const DAILY_URL = 'https://lichess.org/api/puzzle/daily'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type DailyJson = {
  game?: { pgn?: string; players?: { name?: string; color?: string }[]; perf?: { name?: string } }
  puzzle?: { id?: string; rating?: number; solution?: string[]; themes?: string[] }
}

/** The puzzle's level from its Lichess rating. */
export const levelOf = (rating: number): Level => (rating < 1500 ? 'easy' : rating < 2000 ? 'medium' : 'hard')

/** Reads the Lichess answer into a puzzle the pane can deal; throws if it does not hold together. */
export const dailyFromLichess = (text: string): DailyPuzzle => {
  const data = JSON.parse(text) as DailyJson
  const id = data.puzzle?.id
  const solution = data.puzzle?.solution
  const pgn = data.game?.pgn
  if (!id || !pgn || !solution?.length || solution.length % 2 === 0) throw new Error('not a Lichess puzzle')

  let position = parseFen(START)
  for (const san of pgn.trim().split(/\s+/)) {
    const uci = fromSan(position, san)
    if (!uci) throw new Error(`cannot play ${san}`)
    position = applyUci(position, uci)
  }
  const fen = toFen(position)

  const san: string[] = []
  let line = position
  for (const uci of solution) {
    san.push(toSan(line, uci))
    line = applyUci(line, uci)
  }

  const rating = data.puzzle?.rating ?? 1500
  const mate = data.puzzle?.themes?.map(theme => theme.match(/^mateIn(\d)$/)?.[1]).find(Boolean)
  const name = (color: string) => data.game?.players?.find(player => player.color === color)?.name ?? '?'
  const perf = data.game?.perf?.name
  return {
    id,
    rating,
    title: mate ? `Mate in ${mate}` : 'Find the best line',
    level: levelOf(rating),
    game: `${name('white')} vs ${name('black')}${perf ? `, ${perf}` : ''} on Lichess · rated ${rating}`,
    fen,
    moves: solution,
    san,
  }
}
