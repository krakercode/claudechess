export type PuzzleStatus = 'solving' | 'solved' | 'revealed'

export type PuzzleProgress = {
  /** Index into PUZZLES of the puzzle on the board. */
  index: number
  /** Dealt again from the review queue, after a miss. */
  isReview: boolean
  /** Moves of the solution line already played. */
  ply: number
  /** The position on the board, as FEN. */
  fen: string
  /** The square picked as the from-square of a move, if any. */
  selected: string | null
  /** The line under the board: feedback on the last move. */
  message: string
  status: PuzzleStatus
  /** Wrong tries on this puzzle. */
  misses: number
}

export type PuzzleStats = { solved: number; streak: number }

/** Which puzzles are dealt: one level, or all of them from easiest to hardest. */
export type LevelChoice = 'mixed' | 'easy' | 'medium' | 'hard'

declare module 'claude-code' {
  interface PluginState {
    'chess-puzzles': {
      progress: PuzzleProgress | null
      stats: PuzzleStats
      isWorking: boolean
      level: LevelChoice
      /** Puzzles missed, revealed or solved after a hint, oldest first, as indexes into PUZZLES. */
      review: number[]
    }
  }
}
