// The famous games section: step through a game, guess the winner's moves,
// or play on from any position against a Stockfish installed on this
// machine. Stockfish is not bundled; it runs only if you have it.

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EngineGame, GameState } from '../types'
import { boardOf, colorOf, moveBetween, outcomeOf, play, playSan, resolveMove, squareIndex, turnOf } from './chess.ts'
import type { Move } from './chess.ts'
import { FAMOUS } from './famous.ts'
import type { FamousGame } from './famous.ts'
import { INITIAL, KEY, setView } from './state.ts'

const famousPage = atom({ plugin: 'chess-puzzles', key: 'famousPage' } as const, INITIAL.famousPage)
const game = atom({ plugin: 'chess-puzzles', key: 'game' } as const, INITIAL.game)
const settings = atom({ plugin: 'chess-puzzles', key: 'settings' } as const, INITIAL.settings)

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const PAGE_SIZE = 8

export type Line = { fens: string[]; moves: Move[] }

const lines = new Map<string, Line>()

/** Every position of a game and the moves between them; worked out once per game. */
export const lineOf = (famous: FamousGame): Line => {
  const known = lines.get(famous.id)
  if (known) return known
  const fens = [START_FEN]
  const moves: Move[] = []
  for (const san of famous.moves.split(' ')) {
    const played = playSan(fens.at(-1)!, san)
    moves.push({ uci: played.uci, san: played.san })
    fens.push(played.fen)
  }
  const line = { fens, moves }
  lines.set(famous.id, line)
  return line
}

export const famousFor = (id: string): FamousGame | undefined => FAMOUS.find(famous => famous.id === id)

/** A move as a game score writes it: `17. Nd5` or `17... Qxb2`. */
export const numbered = (ply: number, san: string): string => `${Math.floor(ply / 2) + 1}.${ply % 2 ? '..' : ''} ${san}`

/** The side the guesser plays: the winner's, or White's in a draw. */
export const guesserOf = (famous: FamousGame): 'w' | 'b' => (famous.result === '0-1' ? 'b' : 'w')

const fresh = (famous: FamousGame, ply = 0): GameState => ({
  id: famous.id,
  ply,
  mode: 'replay',
  selected: null,
  message: '',
  guess: { tried: 0, matched: 0 },
  guessMissed: false,
  engine: null,
})

async function remember($: EngineInterface, state: GameState) {
  await $.store.set(KEY.famous, { id: state.id, ply: state.ply })
}

/** Opens a game in the viewer, at the position you last left it. */
export async function openGame($: EngineInterface, id: string) {
  const famous = famousFor(id)
  if (!famous) return
  const saved = (await $.store.get(KEY.famous)) as { id?: unknown; ply?: unknown } | undefined
  const ply = saved?.id === id && typeof saved.ply === 'number' ? Math.min(Math.max(0, saved.ply), lineOf(famous).moves.length) : 0
  const state = fresh(famous, ply)
  await update($, game, () => state)
  await setView($, 'game')
}

async function withGame($: EngineInterface): Promise<{ state: GameState; famous: FamousGame; line: Line } | null> {
  const state = await read($, game)
  const famous = state && famousFor(state.id)
  return state && famous ? { state, famous, line: lineOf(famous) } : null
}

/** Moves the replay to a ply, from 0 (the start) to the game's last move. */
export async function goTo($: EngineInterface, ply: number) {
  const now = await withGame($)
  if (!now) return
  const target = Math.min(Math.max(0, ply), now.line.moves.length)
  await update($, game, value => value && { ...value, ply: target, mode: 'replay' as const, selected: null, guessMissed: false, engine: null, message: '' })
  await remember($, { ...now.state, ply: target })
}

export async function step($: EngineInterface, delta: number) {
  const now = await withGame($)
  if (now) await goTo($, now.state.ply + delta)
}

/** The position on the board in the viewer, in whichever mode it is. */
export const boardFen = (state: GameState, line: Line): string => state.engine?.fen ?? line.fens[state.ply]!

// Guess the move.

/** In guess mode, plays the opponent's moves until it is the guesser's turn or the game ends. */
const advanceToGuesser = (famous: FamousGame, line: Line, ply: number): { ply: number; replies: string[] } => {
  const side = guesserOf(famous)
  const replies: string[] = []
  let at = ply
  while (at < line.moves.length && turnOf(line.fens[at]!) !== side) {
    replies.push(numbered(at, line.moves[at]!.san))
    at++
  }
  return { ply: at, replies }
}

const guessPrompt = (famous: FamousGame, line: Line, ply: number): string =>
  ply >= line.moves.length
    ? `That's the end of the game (${famous.result}).`
    : `${guesserOf(famous) === 'w' ? famous.white : famous.black} to play move ${Math.floor(ply / 2) + 1}. What did they play?`

/** Starts guessing the winner's moves from the position on the board. */
export async function startGuess($: EngineInterface) {
  const now = await withGame($)
  if (!now) return
  const { ply, replies } = advanceToGuesser(now.famous, now.line, now.state.ply)
  await update($, game, value =>
    value && {
      ...value,
      mode: 'guess' as const,
      ply,
      selected: null,
      guess: { tried: 0, matched: 0 },
      guessMissed: false,
      engine: null,
      message: `${replies.length ? `${replies.join(' ')}. ` : ''}${guessPrompt(now.famous, now.line, ply)}`,
    },
  )
}

/** A guess at the game move: right, wrong once (try again), or wrong twice (shown). */
async function guessMove($: EngineInterface, move: Move) {
  const now = await withGame($)
  if (!now || now.state.mode !== 'guess' || now.state.ply >= now.line.moves.length) return
  const actual = now.line.moves[now.state.ply]!
  const isRight = move.uci === actual.uci
  if (!isRight && !now.state.guessMissed) {
    await update($, game, value => value && { ...value, selected: null, guessMissed: true, message: `${move.san} isn't the game move. One more try.` })
    return
  }
  const played = numbered(now.state.ply, actual.san)
  const { ply, replies } = advanceToGuesser(now.famous, now.line, now.state.ply + 1)
  const guess = { tried: now.state.guess.tried + 1, matched: now.state.guess.matched + (isRight ? 1 : 0) }
  const verdict = isRight ? `Yes: ${played}.` : `The game went ${played}.`
  await update($, game, value =>
    value && {
      ...value,
      ply,
      selected: null,
      guessMissed: false,
      guess,
      message: `${verdict} ${replies.length ? `${replies.join(' ')}. ` : ''}${guessPrompt(now.famous, now.line, ply)}`,
    },
  )
  await remember($, { ...now.state, ply })
}

/** Gives up on the move to guess and shows it. */
export async function revealGuess($: EngineInterface) {
  const now = await withGame($)
  if (!now || now.state.mode !== 'guess' || now.state.ply >= now.line.moves.length) return
  await update($, game, value => value && { ...value, guessMissed: true })
  await guessMove($, { uci: '', san: '' })
}

// Play from here against Stockfish.

const ENGINE_THINK_MS = 700

/**
 * Asks Stockfish for its move. The trailing `ucinewgame` makes it finish the
 * search before it reads the end of its input, so a one-shot run works.
 */
export async function askEngine($: EngineInterface, command: string, fen: string, elo: number | null): Promise<string> {
  const strength = elo === null ? '' : `setoption name UCI_LimitStrength value true\nsetoption name UCI_Elo value ${Math.min(3190, Math.max(1320, elo))}\n`
  const input = `uci\n${strength}isready\nposition fen ${fen}\ngo movetime ${ENGINE_THINK_MS}\nucinewgame\nisready\n`
  const ran = await $.process.run([command], { stdin: input, timeoutMs: 20_000 })
  const best = ran.stdout.match(/^bestmove (\S+)/m)?.[1]
  if (!best || best === '(none)') throw new Error(ran.stderr.trim() || 'no move came back')
  return best
}

const overText = (fen: string): string | null => {
  const outcome = outcomeOf(fen)
  if (!outcome.isOver) return null
  if (outcome.reason === 'checkmate') return `Checkmate: ${turnOf(fen) === 'w' ? 'Black' : 'White'} wins.`
  if (outcome.reason === 'stalemate') return 'Stalemate: a draw.'
  return 'A draw.'
}

async function engineReply($: EngineInterface, engine: EngineGame): Promise<EngineGame & { message: string }> {
  const { engine: command, engineElo } = await read($, settings)
  try {
    const uci = await askEngine($, command, engine.fen, engineElo)
    const played = play(engine.fen, uci)
    const over = overText(played.fen)
    return { ...engine, moves: [...engine.moves, uci], fen: played.fen, isThinking: false, over, message: `Stockfish plays ${played.san}.${over ? ` ${over}` : ' Your move.'}` }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      ...engine,
      isThinking: false,
      over: 'Stockfish could not be run.',
      message: `Couldn't run Stockfish (${command}): ${reason.slice(0, 160)}. Install it, or point /chess engine at it.`,
    }
  }
}

/** Starts a game against Stockfish from the position on the board; you take the side to move. */
export async function startEngine($: EngineInterface) {
  const now = await withGame($)
  if (!now) return
  const fen = now.line.fens[now.state.ply]!
  const over = overText(fen)
  const engine: EngineGame = { start: fen, moves: [], fen, side: turnOf(fen), isThinking: false, over }
  await update($, game, value =>
    value && {
      ...value,
      mode: 'engine' as const,
      selected: null,
      guessMissed: false,
      engine,
      message: over ?? `You play ${engine.side === 'w' ? 'White' : 'Black'} from here against Stockfish. Your move.`,
    },
  )
}

async function engineMove($: EngineInterface, move: Move) {
  const now = await withGame($)
  const engine = now?.state.engine
  if (!now || now.state.mode !== 'engine' || !engine || engine.over || engine.isThinking || turnOf(engine.fen) !== engine.side) return
  const played = play(engine.fen, move.uci)
  const over = overText(played.fen)
  const afterMine: EngineGame = { ...engine, moves: [...engine.moves, move.uci], fen: played.fen, isThinking: !over, over }
  await update($, game, value => value && { ...value, selected: null, engine: afterMine, message: over ? `${move.san}. ${over}` : `${move.san}. Stockfish is thinking…` })
  if (over) return
  const reply = await engineReply($, afterMine)
  const { message, ...next } = reply
  await update($, game, value => value && value.mode === 'engine' ? { ...value, engine: next, message } : value)
}

/** Takes back your last move and Stockfish's reply. */
export async function takeBack($: EngineInterface) {
  const now = await withGame($)
  const engine = now?.state.engine
  if (!engine || engine.isThinking || engine.moves.length === 0) return
  const keep = engine.moves.length - (turnOf(engine.fen) === engine.side ? 2 : 1)
  const moves = engine.moves.slice(0, Math.max(0, keep))
  let fen = engine.start
  for (const uci of moves) fen = play(fen, uci).fen
  await update($, game, value => value && { ...value, selected: null, engine: { ...engine, moves, fen, over: null }, message: 'Taken back. Your move.' })
}

/** Leaves guessing or the engine game and goes back to stepping through the game. */
export async function backToReplay($: EngineInterface) {
  const now = await withGame($)
  if (now) await goTo($, now.state.ply)
}

// Input, whichever mode the viewer is in.

async function moveForMode($: EngineInterface, move: Move) {
  const state = await read($, game)
  if (state?.mode === 'guess') await guessMove($, move)
  else if (state?.mode === 'engine') await engineMove($, move)
}

export async function typedInGame($: EngineInterface, typed: string) {
  const now = await withGame($)
  if (!now || now.state.mode === 'replay') return
  const fen = boardFen(now.state, now.line)
  const move = resolveMove(fen, typed)
  if (!move) {
    await update($, game, value => value && { ...value, message: `${typed.trim() || 'That'} isn't a legal move here.` })
    return
  }
  await moveForMode($, move)
}

export async function pressInGame($: EngineInterface, square: string) {
  const now = await withGame($)
  if (!now || now.state.mode === 'replay') return
  const fen = boardFen(now.state, now.line)
  const piece = boardOf(fen)[squareIndex(square)]
  const isOwn = piece !== null && piece !== undefined && colorOf(piece) === turnOf(fen)
  if (now.state.selected === square) {
    await update($, game, value => value && { ...value, selected: null })
    return
  }
  if (now.state.selected) {
    const actual = now.state.mode === 'guess' ? (now.line.moves[now.state.ply]?.uci ?? '') : ''
    const promotion = actual.startsWith(now.state.selected + square) ? (actual[4] ?? 'q') : 'q'
    const move = moveBetween(fen, now.state.selected, square, promotion)
    if (move) {
      await moveForMode($, move)
      return
    }
  }
  await update($, game, value => value && { ...value, selected: isOwn ? square : null })
}

export const pageCount = Math.ceil(FAMOUS.length / PAGE_SIZE)

export async function turnPage($: EngineInterface, delta: number) {
  await update($, famousPage, page => Math.min(pageCount - 1, Math.max(0, page + delta)))
}
