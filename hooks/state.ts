// The session's values the pane draws from, and the store keys that carry
// them across sessions.

import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { ChessSettings, Difficulty, Drill, GameState, PuzzleProgress, PuzzleStats, RatingState, ThemeRecord, View } from '../types'
import { START } from './rating.ts'

/**
 * The starting value of each session value. Every file that reads or writes
 * one declares its own atom of it with the same reference, as the engine
 * reads a module's state from the file it is used in.
 */
export const INITIAL = {
  progress: null as PuzzleProgress | null,
  stats: { solved: 0, streak: 0, bestStreak: 0 } as PuzzleStats,
  rating: {
    rating: START.rating,
    deviation: START.deviation,
    volatility: START.volatility,
    peak: START.rating,
    played: 0,
    wins: 0,
    history: [],
  } as RatingState,
  themeRecord: {} as ThemeRecord,
  isWorking: false,
  difficulty: 'normal' as Difficulty,
  drill: { kind: 'any' } as Drill,
  view: 'puzzle' as View,
  game: null as GameState | null,
  settings: { pieces: 'symbols', engine: 'stockfish', engineElo: 1500 } as ChessSettings,
  famousPage: 0,
}

const stats = atom({ plugin: 'chess-puzzles', key: 'stats' } as const, INITIAL.stats)
const rating = atom({ plugin: 'chess-puzzles', key: 'rating' } as const, INITIAL.rating)
const themeRecord = atom({ plugin: 'chess-puzzles', key: 'themeRecord' } as const, INITIAL.themeRecord)
const difficulty = atom({ plugin: 'chess-puzzles', key: 'difficulty' } as const, INITIAL.difficulty)
const drill = atom({ plugin: 'chess-puzzles', key: 'drill' } as const, INITIAL.drill)
const view = atom({ plugin: 'chess-puzzles', key: 'view' } as const, INITIAL.view)
const settings = atom({ plugin: 'chess-puzzles', key: 'settings' } as const, INITIAL.settings)

/** $.store keys: kept across sessions. */
export const KEY = {
  stats: 'stats',
  rating: 'rating',
  themeRecord: 'themeRecord',
  current: 'current',
  seen: 'seen',
  mastersNext: 'mastersNext',
  difficulty: 'difficulty',
  drill: 'drill',
  autoOpen: 'autoOpen',
  settings: 'settings',
  famous: 'famous',
} as const

/** How many recent puzzles are kept out of the deal. */
export const SEEN_LIMIT = 3000

export const DIFFICULTIES: Difficulty[] = ['easiest', 'easier', 'normal', 'harder', 'hardest']
export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easiest: 'Easiest',
  easier: 'Easier',
  normal: 'Normal',
  harder: 'Harder',
  hardest: 'Hardest',
}
/** Lichess's own offsets from your rating. */
export const DIFFICULTY_OFFSET: Record<Difficulty, number> = { easiest: -600, easier: -300, normal: 0, harder: 300, hardest: 600 }

export const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.includes(value as Difficulty)

const isDrill = (value: unknown): value is Drill => {
  const drill = value as Drill | undefined
  return (
    drill?.kind === 'any' ||
    drill?.kind === 'masters' ||
    (drill?.kind === 'theme' && typeof (drill as { theme?: unknown }).theme === 'string')
  )
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Reads what the store kept into the session's values; anything malformed is left at its default. */
export async function loadStored($: EngineInterface) {
  const savedStats = (await $.store.get(KEY.stats)) as Partial<PuzzleStats> | undefined
  if (savedStats && isNumber(savedStats.solved)) {
    await update($, stats, () => ({
      solved: savedStats.solved ?? 0,
      streak: isNumber(savedStats.streak) ? savedStats.streak : 0,
      bestStreak: isNumber(savedStats.bestStreak) ? savedStats.bestStreak : (savedStats.streak ?? 0),
    }))
  }
  const savedRating = (await $.store.get(KEY.rating)) as Partial<RatingState> | undefined
  if (savedRating && isNumber(savedRating.rating) && isNumber(savedRating.deviation) && isNumber(savedRating.volatility)) {
    await update($, rating, value => ({
      ...value,
      ...savedRating,
      history: Array.isArray(savedRating.history) ? savedRating.history.filter(isNumber) : [],
    }))
  }
  const savedThemes = (await $.store.get(KEY.themeRecord)) as ThemeRecord | undefined
  if (savedThemes && typeof savedThemes === 'object') await update($, themeRecord, () => savedThemes)
  const savedDifficulty = await $.store.get(KEY.difficulty)
  if (isDifficulty(savedDifficulty)) await update($, difficulty, () => savedDifficulty)
  const savedDrill = await $.store.get(KEY.drill)
  if (isDrill(savedDrill)) await update($, drill, () => savedDrill)
  const savedSettings = (await $.store.get(KEY.settings)) as Partial<ChessSettings> | undefined
  if (savedSettings && typeof savedSettings === 'object') {
    await update($, settings, value => ({
      pieces: savedSettings.pieces === 'letters' ? 'letters' : value.pieces,
      engine: typeof savedSettings.engine === 'string' && savedSettings.engine.trim() ? savedSettings.engine : value.engine,
      engineElo: savedSettings.engineElo === null || isNumber(savedSettings.engineElo) ? savedSettings.engineElo : value.engineElo,
    }))
  }
}

export async function saveStats($: EngineInterface, value: PuzzleStats) {
  await $.store.set(KEY.stats, value)
}

export async function setView($: EngineInterface, next: View) {
  await update($, view, () => next)
}

/** A number in [0, 1) from the environment's crypto. */
export const random = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32
