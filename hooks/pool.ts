// The puzzles the pane deals: the Lichess sample in puzzles.ts, rated, and the
// master-game puzzles in masters.ts, unrated. Both are read into one shape.

import { fullFen, play, sanLine, turnOf } from './chess.ts'
import { MASTERS } from './masters.ts'
import { LICHESS_THEMES, POOL } from './puzzles.ts'
import { themeName } from './themes.ts'

export type Puzzle = {
  /** `l:<Lichess id>` or `m:<index in masters.ts>`; what the store keeps. */
  key: string
  title: string
  /** The puzzle's rating; absent for an unrated one. */
  rating?: number
  themes: string[]
  /** Where it comes from, for the line under the board. */
  credit: string
  link?: string
  /** The position the solver moves in. */
  fen: string
  /** The opponent's move that led to it, when the puzzle shows one. */
  lastMove?: { uci: string; san: string }
  /** The solution in UCI, the solver's moves and the replies alternating. */
  moves: string[]
  san: string[]
}

type Row = { id: string; fen: string; moves: string[]; rating: number; codes: number[] }

/** The Lichess sample, ordered by rating, read once. */
export const ROWS: Row[] = POOL.split('\n').map(line => {
  const [id = '', fen = '', moves = '', rating = '0', codes = ''] = line.split('|')
  return {
    id,
    fen,
    moves: moves.split(' '),
    rating: Number(rating),
    codes: codes ? codes.split('.').map(code => parseInt(code, 16)) : [],
  }
})

export const themeCode = (theme: string): number => (LICHESS_THEMES as readonly string[]).indexOf(theme)

const titleOf = (themes: string[], solverMoves: number): string => {
  if (themes.includes('mate')) return solverMoves === 1 ? 'Mate in 1' : `Mate in ${solverMoves}`
  if (themes.includes('equality')) return 'Save the game'
  return 'Find the best move'
}

const fromRow = (row: Row): Puzzle => {
  const setup = play(fullFen(row.fen), row.moves[0]!)
  const moves = row.moves.slice(1)
  const themes = row.codes.map(code => LICHESS_THEMES[code] ?? '').filter(Boolean)
  return {
    key: `l:${row.id}`,
    title: titleOf(themes, (moves.length + 1) / 2),
    rating: row.rating,
    themes,
    credit: `Lichess puzzle ${row.id}`,
    link: `https://lichess.org/training/${row.id}`,
    fen: setup.fen,
    lastMove: { uci: setup.uci, san: setup.san },
    moves,
    san: sanLine(setup.fen, moves),
  }
}

const fromMaster = (index: number): Puzzle => {
  const master = MASTERS[index]!
  return {
    key: `m:${index}`,
    title: master.title,
    themes: [],
    credit: `From ${master.game}`,
    fen: fullFen(master.fen),
    moves: master.moves,
    san: master.san,
  }
}

const byId = new Map(ROWS.map((row, index) => [row.id, index]))

/** The puzzle a key names, or undefined when the set no longer has it. */
export const puzzleFor = (key: string): Puzzle | undefined => {
  const [kind, rest = ''] = [key.slice(0, 1), key.slice(2)]
  if (kind === 'l') {
    const index = byId.get(rest)
    return index === undefined ? undefined : fromRow(ROWS[index]!)
  }
  if (kind === 'm') {
    const index = Number(rest)
    return Number.isInteger(index) && MASTERS[index] ? fromMaster(index) : undefined
  }
  return undefined
}

/** How many Lichess puzzles carry a theme. */
export const countOf = (theme: string): number => {
  const code = themeCode(theme)
  return ROWS.filter(row => row.codes.includes(code)).length
}

/** The first index whose rating is at least `rating`. */
const lowerBound = (rating: number): number => {
  let lo = 0
  let hi = ROWS.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ROWS[mid]!.rating < rating) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Picks a Lichess puzzle near `target`: among the nearest few that carry the
 * theme (any, when `theme` is undefined) and are not in `seen`, one at random.
 * When every one with the theme has been seen, `seen` is ignored.
 */
export const pickNear = (target: number, theme: string | undefined, seen: ReadonlySet<string>, random: () => number): Puzzle => {
  const code = theme === undefined ? -1 : themeCode(theme)
  const fits = (row: Row) => code < 0 || row.codes.includes(code)
  const gather = (skipSeen: boolean): Row[] => {
    const found: Row[] = []
    const start = lowerBound(target)
    let left = start - 1
    let right = start
    while (found.length < 12 && (left >= 0 || right < ROWS.length)) {
      const leftGap = left >= 0 ? target - ROWS[left]!.rating : Infinity
      const rightGap = right < ROWS.length ? ROWS[right]!.rating - target : Infinity
      const row = leftGap <= rightGap ? ROWS[left--]! : ROWS[right++]!
      if (fits(row) && !(skipSeen && seen.has(`l:${row.id}`))) found.push(row)
    }
    return found
  }
  const near = gather(true)
  const pool = near.length > 0 ? near : gather(false)
  const row = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!
  return fromRow(row)
}

/** The puzzle dealt after `index` in the master-game set, wrapping round. */
export const nextMaster = (index: number): Puzzle => fromMaster(((index % MASTERS.length) + MASTERS.length) % MASTERS.length)

export const MASTER_COUNT = MASTERS.length

/** Who the solver is in a puzzle: the side to move at the start. */
export const solverOf = (puzzle: Puzzle): 'White' | 'Black' => (turnOf(puzzle.fen) === 'w' ? 'White' : 'Black')

export const describeThemes = (puzzle: Puzzle): string => puzzle.themes.map(themeName).join(', ')
