export type PuzzleStatus = 'solving' | 'solved' | 'failed' | 'revealed'

export type PuzzleProgress = {
  /** The puzzle on the board: `l:<Lichess id>` or `m:<master index>`. */
  key: string
  /** Moves of the solution line already played. */
  ply: number
  /** The position on the board, as FEN. */
  fen: string
  /** The square picked as the from-square of a move, if any. */
  selected: string | null
  /** The line under the board: feedback on the last move. */
  message: string
  status: PuzzleStatus
  /** Wrong moves on this puzzle; the second one shows the solution. */
  misses: number
  hinted: boolean
  /** Whether the result has gone into your stats and rating yet. */
  isScored: boolean
  /** A puzzle tried again after it was over: it counts for nothing. */
  isPractice: boolean
  /** The last move played on the board, in UCI, to highlight. */
  lastMove: string | null
  /** How much the result moved your rating, once a rated puzzle is scored. */
  ratingChange: number | null
}

export type PuzzleStats = {
  solved: number
  /** Clean solves in a row: no wrong move, hint or solution. */
  streak: number
  bestStreak: number
}

export type RatingState = {
  rating: number
  deviation: number
  volatility: number
  peak: number
  /** Rated puzzles played, and won. */
  played: number
  wins: number
  /** Your rating after each of the last rated puzzles, oldest first. */
  history: number[]
}

/** Per theme: rated puzzles played with it, and won. */
export type ThemeRecord = Record<string, [number, number]>

/** How far from your rating the puzzles are dealt, as on Lichess. */
export type Difficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest'

/** Which puzzles are dealt: any rated one, one theme's, or the master-game set. */
export type Drill = { kind: 'any' } | { kind: 'theme'; theme: string } | { kind: 'masters' }

export type View = 'puzzle' | 'themes' | 'famous' | 'game' | 'stats'

export type GameMode = 'replay' | 'guess' | 'engine'

export type GuessScore = { tried: number; matched: number }

export type EngineGame = {
  /** The position the engine game started from, and the moves since, in UCI. */
  start: string
  moves: string[]
  fen: string
  /** Your side in it. */
  side: 'w' | 'b'
  isThinking: boolean
  /** Why it is over, once it is. */
  over: string | null
}

export type GameState = {
  /** The famous game open in the viewer. */
  id: string
  /** Moves of the game played on the board. */
  ply: number
  mode: GameMode
  selected: string | null
  message: string
  guess: GuessScore
  /** A wrong guess at the current move: the next one shows the game move. */
  guessMissed: boolean
  engine: EngineGame | null
}

export type ChessSettings = {
  pieces: 'symbols' | 'letters'
  /** The Stockfish to run for play from here: a command on PATH or a path. */
  engine: string
  /** The strength Stockfish plays at, as an Elo; null for full strength. */
  engineElo: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'chess-puzzles': {
      progress: PuzzleProgress | null
      stats: PuzzleStats
      rating: RatingState
      themeRecord: ThemeRecord
      isWorking: boolean
      difficulty: Difficulty
      drill: Drill
      view: View
      game: GameState | null
      settings: ChessSettings
      famousPage: number
    }
  }
}
