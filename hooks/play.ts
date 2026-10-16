// Solving puzzles: dealing one, checking each move against the solution, the
// one retry before the solution is shown, hints, and scoring the result into
// your stats, theme record and rating.

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PuzzleProgress, ThemeRecord } from '../types'
import { moveBetween, outcomeOf, pieceName, play, resolveMove, boardOf, colorOf, squareIndex, turnOf } from './chess.ts'
import type { Move } from './chess.ts'
import { nextMaster, pickNear, puzzleFor, solverOf } from './pool.ts'
import type { Puzzle } from './pool.ts'
import { isProvisional, rate } from './rating.ts'
import { DIFFICULTY_OFFSET, INITIAL, KEY, SEEN_LIMIT, random, saveStats } from './state.ts'

const difficulty = atom({ plugin: 'chess-puzzles', key: 'difficulty' } as const, INITIAL.difficulty)
const drill = atom({ plugin: 'chess-puzzles', key: 'drill' } as const, INITIAL.drill)
const progress = atom({ plugin: 'chess-puzzles', key: 'progress' } as const, INITIAL.progress)
const rating = atom({ plugin: 'chess-puzzles', key: 'rating' } as const, INITIAL.rating)
const stats = atom({ plugin: 'chess-puzzles', key: 'stats' } as const, INITIAL.stats)
const themeRecord = atom({ plugin: 'chess-puzzles', key: 'themeRecord' } as const, INITIAL.themeRecord)

/** How a rating reads: rounded, with a question mark while still provisional. */
export const ratingText = (value: { rating: number; deviation: number }): string =>
  `${Math.round(value.rating)}${isProvisional(value) ? '?' : ''}`

const opponentOf = (puzzle: Puzzle) => (solverOf(puzzle) === 'White' ? 'Black' : 'White')

/** The board as a puzzle starts: the opponent's last move named, then the task. */
export const fresh = (puzzle: Puzzle, isPractice = false): PuzzleProgress => ({
  key: puzzle.key,
  ply: 0,
  fen: puzzle.fen,
  selected: null,
  message: `${puzzle.lastMove ? `${opponentOf(puzzle)} played ${puzzle.lastMove.san}. ` : ''}${solverOf(puzzle)} to move: ${puzzle.title.toLowerCase()}.${isPractice ? ' (Practice: this one counts for nothing.)' : ''}`,
  status: 'solving',
  misses: 0,
  hinted: false,
  isScored: isPractice,
  isPractice,
  lastMove: puzzle.lastMove?.uci ?? null,
  ratingChange: null,
})

async function readSeen($: EngineInterface): Promise<string[]> {
  const saved = await $.store.get(KEY.seen)
  return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []
}

/**
 * Chooses the next puzzle without writing anything: the next master-game one,
 * or a rated one near your rating. `random` picks among the nearest few; a
 * drawing passes none, so what it shows is what the first act deals.
 */
async function choose($: EngineInterface, random?: () => number): Promise<Puzzle> {
  const choice = await read($, drill)
  if (choice.kind === 'masters') return nextMaster(Number((await $.store.get(KEY.mastersNext)) ?? 0) || 0)
  const mine = await read($, rating)
  const target = mine.rating + DIFFICULTY_OFFSET[await read($, difficulty)]
  const seen = await readSeen($)
  return pickNear(target, choice.kind === 'theme' ? choice.theme : undefined, new Set(seen), random ?? (() => 0))
}

/** Puts a chosen puzzle on the board and remembers it, and that it was dealt. */
async function commit($: EngineInterface, puzzle: Puzzle) {
  if (puzzle.key.startsWith('m:')) {
    await $.store.set(KEY.mastersNext, Number(puzzle.key.slice(2)) + 1)
  } else {
    const seen = await readSeen($)
    await $.store.set(KEY.seen, [...seen.filter(key => key !== puzzle.key), puzzle.key].slice(-SEEN_LIMIT))
  }
  await $.store.set(KEY.current, puzzle.key)
  await update($, progress, () => fresh(puzzle))
}

/** Deals a new puzzle onto the board and remembers it for the next session. */
export async function dealNext($: EngineInterface) {
  await commit($, await choose($, random))
}

/** The puzzle on the board, or the one that would be dealt; writes nothing, so a drawing may call it. */
export async function peek($: EngineInterface): Promise<{ now: PuzzleProgress; puzzle: Puzzle }> {
  const now = await read($, progress)
  const puzzle = now ? puzzleFor(now.key) : undefined
  if (now && puzzle) return { now, puzzle }
  const saved = await $.store.get(KEY.current)
  const resumed = typeof saved === 'string' ? puzzleFor(saved) : undefined
  const shown = resumed ?? (await choose($))
  return { now: fresh(shown), puzzle: shown }
}

/** The puzzle on the board: the one a drawing shows when none is dealt yet, put there now. */
export async function current($: EngineInterface): Promise<{ now: PuzzleProgress; puzzle: Puzzle }> {
  const now = await read($, progress)
  const puzzle = now ? puzzleFor(now.key) : undefined
  if (now && puzzle) return { now, puzzle }
  const shown = await peek($)
  if ((await $.store.get(KEY.current)) === shown.puzzle.key) {
    await update($, progress, value => value ?? shown.now)
  } else {
    await commit($, shown.puzzle)
  }
  const placed = (await read($, progress))!
  return { now: placed, puzzle: puzzleFor(placed.key)! }
}

/**
 * Puts a result into the streak, and for a rated puzzle the rating and theme
 * record; once per puzzle, at the first thing that decides it: a clean solve
 * wins, a wrong move, a hint or the solution shown loses.
 */
async function score($: EngineInterface, puzzle: Puzzle, isWin: boolean) {
  const now = await read($, progress)
  if (!now || now.isScored) return
  await update($, progress, value => value && { ...value, isScored: true })

  await update($, stats, value => {
    const streak = isWin ? value.streak + 1 : 0
    return { ...value, streak, bestStreak: Math.max(value.bestStreak, streak) }
  })
  await saveStats($, await read($, stats))

  if (puzzle.rating === undefined) return
  const before = await read($, rating)
  const after = rate(before, puzzle.rating, isWin ? 1 : 0)
  await update($, rating, value => ({
    ...value,
    ...after,
    peak: isProvisional(after) ? value.peak : Math.max(value.peak, after.rating),
    played: value.played + 1,
    wins: value.wins + (isWin ? 1 : 0),
    history: [...value.history, Math.round(after.rating)].slice(-60),
  }))
  await $.store.set(KEY.rating, await read($, rating))
  const change = Math.round(after.rating) - Math.round(before.rating)
  await update($, progress, value => value && { ...value, ratingChange: change })

  await update($, themeRecord, value => {
    const record: ThemeRecord = { ...value }
    for (const theme of puzzle.themes) {
      const [played = 0, won = 0] = record[theme] ?? []
      record[theme] = [played + 1, won + (isWin ? 1 : 0)]
    }
    return record
  })
  await $.store.set(KEY.themeRecord, await read($, themeRecord))
}

/** Counts a solve: any puzzle solved, unless it was practice. */
async function countSolve($: EngineInterface) {
  await update($, stats, value => ({ ...value, solved: value.solved + 1 }))
  await saveStats($, await read($, stats))
}

/** The rating change for the end-of-puzzle message, once a rated puzzle is scored. */
async function ratingNote($: EngineInterface): Promise<string> {
  const now = await read($, progress)
  if (!now || now.ratingChange === null || now.isPractice) return ''
  const change = now.ratingChange
  return ` Rating ${ratingText(await read($, rating))} (${change >= 0 ? '+' : ''}${change}).`
}

/** Plays the person's move: the solution's goes on, with the reply after it; another is a miss. */
export async function tryMove($: EngineInterface, move: Move) {
  const { now, puzzle } = await current($)
  if (now.status !== 'solving') return
  const expected = puzzle.moves[now.ply]!
  const isLast = now.ply === puzzle.moves.length - 1
  const after = play(now.fen, move.uci)
  // As on Lichess, any mate on the last move of a mating puzzle solves it.
  const isMate = isLast && puzzle.themes.includes('mate') && outcomeOf(after.fen).reason === 'checkmate'

  if (move.uci !== expected && !isMate) {
    const misses = now.misses + 1
    await score($, puzzle, false)
    if (misses < 2) {
      await update($, progress, value =>
        value && { ...value, selected: null, misses, message: `${move.san} isn't it. One more try.` },
      )
      return
    }
    const note = await ratingNote($)
    await update($, progress, value =>
      value && {
        ...value,
        selected: null,
        misses,
        status: 'failed' as const,
        message: `${move.san} isn't it either. The solution: ${puzzle.san.slice(now.ply).join(' ')}.${note}`,
      },
    )
    return
  }

  if (isLast) {
    const isClean = now.misses === 0 && !now.hinted
    await score($, puzzle, isClean)
    if (!now.isPractice) await countSolve($)
    const note = await ratingNote($)
    const praise = isClean ? 'solved!' : now.misses > 0 ? 'solved, on your second try.' : 'solved, with a hint.'
    await update($, progress, value =>
      value && { ...value, fen: after.fen, ply: now.ply + 1, selected: null, status: 'solved' as const, lastMove: move.uci, message: `${move.san} — ${praise}${note}` },
    )
    return
  }

  const reply = play(after.fen, puzzle.moves[now.ply + 1]!)
  await update($, progress, value =>
    value && {
      ...value,
      fen: reply.fen,
      ply: now.ply + 2,
      selected: null,
      lastMove: reply.uci,
      message: `${move.san}, good. ${turnOf(after.fen) === 'w' ? 'White' : 'Black'} answers ${reply.san}. Your move.`,
    },
  )
}

/** A typed move: legal ones are tried; anything else is pointed out and costs nothing. */
export async function tryTyped($: EngineInterface, typed: string) {
  const { now } = await current($)
  if (now.status !== 'solving') return
  const move = resolveMove(now.fen, typed)
  if (!move) {
    await update($, progress, value => value && { ...value, message: `${typed.trim() || 'That'} isn't a legal move here.` })
    return
  }
  await tryMove($, move)
}

/** A press on a square: pick up a piece of the side to move, or move it there. */
export async function pressSquare($: EngineInterface, square: string) {
  const { now, puzzle } = await current($)
  if (now.status !== 'solving') return
  const piece = boardOf(now.fen)[squareIndex(square)]
  const isOwn = piece !== null && piece !== undefined && colorOf(piece) === turnOf(now.fen)

  if (now.selected === square) {
    await update($, progress, value => value && { ...value, selected: null })
    return
  }
  if (now.selected) {
    // A promotion picked by clicks takes the piece the solution promotes to.
    const expected = puzzle.moves[now.ply] ?? ''
    const promotion = expected.startsWith(now.selected + square) ? (expected[4] ?? 'q') : 'q'
    const move = moveBetween(now.fen, now.selected, square, promotion)
    if (move) {
      await tryMove($, move)
      return
    }
  }
  await update($, progress, value => value && { ...value, selected: isOwn ? square : null })
}

/** Names the piece to move; the puzzle then no longer counts as a clean solve. */
export async function hint($: EngineInterface) {
  const { now, puzzle } = await current($)
  if (now.status !== 'solving') return
  const from = puzzle.moves[now.ply]!.slice(0, 2)
  const piece = boardOf(now.fen)[squareIndex(from)] ?? ''
  const cost = now.isScored ? '' : puzzle.rating === undefined ? ' It no longer counts as a clean solve.' : ' It counts as a loss now.'
  await score($, puzzle, false)
  await update($, progress, value =>
    value && { ...value, hinted: true, selected: from, message: `Hint: move the ${pieceName(piece)} on ${from}.${cost}` },
  )
}

/** Shows the solution; a puzzle not yet scored counts as a loss. */
export async function reveal($: EngineInterface) {
  const { now, puzzle } = await current($)
  if (now.status !== 'solving') return
  await score($, puzzle, false)
  const note = await ratingNote($)
  await update($, progress, value =>
    value && { ...value, status: 'revealed' as const, selected: null, message: `Solution: ${puzzle.san.slice(now.ply).join(' ')}.${note}` },
  )
}

/** Plays the same puzzle again from the start, for practice: it counts for nothing. */
export async function retry($: EngineInterface) {
  const { puzzle } = await current($)
  await update($, progress, () => fresh(puzzle, true))
}

/** The next puzzle. Skipping one untouched costs nothing. */
export async function nextPuzzle($: EngineInterface) {
  await current($)
  await dealNext($)
}
