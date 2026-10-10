import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PuzzleProgress, PuzzleStats } from '../types'
import { applyUci, colorOf, isSameMove, parseFen, pieceName, squareIndex, squareName, toFen } from './chess.ts'
import { PUZZLES } from './puzzles.ts'

const PANE = 'chess-puzzles'
const TITLE = 'Chess puzzle'

const progress = atom({ plugin: 'chess-puzzles', key: 'progress' } as const, null)
const stats = atom({ plugin: 'chess-puzzles', key: 'stats' } as const, { solved: 0, streak: 0 })
const isWorking = atom({ plugin: 'chess-puzzles', key: 'isWorking' } as const, false)

// $.store keys: kept across sessions.
const NEXT_KEY = 'next'
const STATS_KEY = 'stats'
const AUTO_OPEN_KEY = 'autoOpen'

const sideName = (fen: string) => (parseFen(fen).turn === 'w' ? 'White' : 'Black')

const fresh = (index: number): PuzzleProgress => {
  const puzzle = PUZZLES[index % PUZZLES.length]!
  return {
    index: index % PUZZLES.length,
    ply: 0,
    fen: puzzle.fen,
    selected: null,
    message: `${sideName(puzzle.fen)} to move. ${puzzle.title}.`,
    status: 'solving',
    misses: 0,
  }
}

/** The puzzle on the board, or the one that would be dealt; writes nothing, so a drawing may call it. */
const peek = async ($: EngineInterface): Promise<PuzzleProgress> =>
  (await read($, progress)) ?? fresh(Number((await $.store.get(NEXT_KEY)) ?? 0))

/** The puzzle on the board, dealing the next one from the store if none is. */
const current = async ($: EngineInterface): Promise<PuzzleProgress> => {
  const now = await read($, progress)
  if (now) return now
  const next = Number((await $.store.get(NEXT_KEY)) ?? 0)
  const dealt = fresh(next)
  await update($, progress, value => value ?? dealt)
  return (await read($, progress)) ?? dealt
}

const nextPuzzle = async ($: EngineInterface) => {
  const now = await current($)
  const index = (now.index + 1) % PUZZLES.length
  await $.store.set(NEXT_KEY, index)
  await update($, progress, () => fresh(index))
}

const recordSolve = async ($: EngineInterface, isClean: boolean) => {
  await update($, stats, value => ({
    solved: value.solved + 1,
    streak: isClean ? value.streak + 1 : 0,
  }))
  await $.store.set(STATS_KEY, await read($, stats))
}

/** Plays the person's move if it is the solution's, and the reply after it. */
const tryMove = async ($: EngineInterface, typed: string) => {
  const now = await current($)
  if (now.status !== 'solving') return
  const puzzle = PUZZLES[now.index]!
  const expected = { uci: puzzle.moves[now.ply]!, san: puzzle.san[now.ply]! }

  if (!isSameMove(typed, expected)) {
    await update($, progress, value =>
      value && { ...value, selected: null, misses: value.misses + 1, message: `${typed.trim()} is not it. Try again.` },
    )
    return
  }

  let position = applyUci(parseFen(now.fen), expected.uci)
  let ply = now.ply + 1
  let message: string

  if (ply >= puzzle.moves.length) {
    message = `${expected.san} — solved!`
    await recordSolve($, now.misses === 0)
    await update($, progress, value => value && { ...value, fen: toFen(position), ply, selected: null, status: 'solved' as const, message })
    return
  }

  const reply = puzzle.san[ply]!
  position = applyUci(position, puzzle.moves[ply]!)
  ply += 1
  message = `${expected.san}, good. ${position.turn === 'w' ? 'Black' : 'White'} answers ${reply}. Your move.`
  await update($, progress, value => value && { ...value, fen: toFen(position), ply, selected: null, message })
}

/** A press on a square: pick up a piece of the side to move, or move it. */
const pressSquare = async ($: EngineInterface, square: string) => {
  const now = await current($)
  if (now.status !== 'solving') return
  const position = parseFen(now.fen)
  const piece = position.squares[squareIndex(square)]
  const isOwn = piece !== null && piece !== undefined && colorOf(piece) === position.turn

  if (now.selected === square) {
    await update($, progress, value => value && { ...value, selected: null })
    return
  }
  if (isOwn) {
    await update($, progress, value => value && { ...value, selected: square })
    return
  }
  if (!now.selected) return

  // A promotion picked by clicks takes the piece the solution promotes to.
  const puzzle = PUZZLES[now.index]!
  const expected = puzzle.moves[now.ply] ?? ''
  const uci = now.selected + square
  await tryMove($, expected.startsWith(uci) ? expected : uci)
}

const hint = async ($: EngineInterface) => {
  const now = await current($)
  if (now.status !== 'solving') return
  const puzzle = PUZZLES[now.index]!
  const from = puzzle.moves[now.ply]!.slice(0, 2)
  const piece = parseFen(now.fen).squares[squareIndex(from)] ?? ''
  await update($, progress, value =>
    value && { ...value, misses: value.misses + 1, message: `Hint: move the ${pieceName(piece)} on ${from}.` },
  )
}

const reveal = async ($: EngineInterface) => {
  const now = await current($)
  if (now.status !== 'solving') return
  const puzzle = PUZZLES[now.index]!
  await update($, stats, value => ({ ...value, streak: 0 }))
  await $.store.set(STATS_KEY, await read($, stats))
  await update($, progress, value =>
    value && { ...value, status: 'revealed' as const, selected: null, message: `Solution: ${puzzle.san.join(' ')}` },
  )
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: TITLE })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chess',
      description: 'Open the chess puzzle pane; "/chess off" stops it opening while Claude works, "/chess on" turns that back on',
      argumentHint: '[on|off|next]',
    })
    const saved = (await $.store.get(STATS_KEY)) as PuzzleStats | undefined
    if (saved) await update($, stats, () => saved)
    await current($)

    return next(e)
  })

  on('command.run', { command: 'chess' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      await $.store.set(AUTO_OPEN_KEY, false)
      return { text: 'The chess pane will no longer open by itself while Claude works. /chess still opens it.' }
    }
    if (arg === 'on') {
      await $.store.set(AUTO_OPEN_KEY, true)
      return { text: 'The chess pane will open whenever Claude starts working.' }
    }
    if (arg === 'next') await nextPuzzle($)
    await current($)
    const opened = await openPane($)

    return { text: opened.isPlaced ? 'Chess puzzle pane opened.' : 'Chess puzzle pane is waiting for room to open.' }
  })

  on('turn.start', async ($, e, next) => {
    await update($, isWorking, () => true)
    if ((await $.store.get(AUTO_OPEN_KEY)) !== false) {
      const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
      if (!isOpen) {
        await current($)
        void openPane($)
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => false)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const table = $.ui.resolve(e)
    const now = await peek($)
    const score = await read($, stats)
    const working = await read($, isWorking)
    const puzzle = PUZZLES[now.index]!
    const position = parseFen(now.fen)
    // The board faces the side the person plays: the side to move at the start.
    const isFlipped = parseFen(puzzle.fen).turn === 'b'
    const ranks = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
    const files = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]

    const cell = (index: number) => {
      const square = squareName(index)
      const piece = position.squares[index]
      const isDark = (Math.floor(index / 8) + (index % 8)) % 2 === 1
      const glyph = piece ?? (isDark ? ':' : '·')
      const isSelected = now.selected === square
      return (
        <Button key={square} plain onPress={() => pressSquare($, square)}>
          <Text bold={piece !== null && piece !== undefined && colorOf(piece) === 'w'} dimColor={!piece}>
            {isSelected ? `[${glyph}]` : ` ${glyph} `}
          </Text>
        </Button>
      )
    }

    const Input = 'Input' in table ? table.Input : undefined

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {working ? 'Claude is working. A puzzle while you wait:' : 'Claude is done. Finish up, or close the pane.'}
        </Text>
        <Text>
          <Text bold>#{now.index + 1} {puzzle.title}</Text>
          <Text dimColor> · solved {score.solved} · streak {score.streak}</Text>
        </Text>
        <Box flexDirection="column" marginY={1}>
          {ranks.map(rank => (
            <Box key={`rank-${rank}`} flexDirection="row">
              <Text dimColor>{8 - rank} </Text>
              {files.map(file => cell(rank * 8 + file))}
            </Box>
          ))}
          <Text dimColor>{'  ' + files.map(file => ` ${'abcdefgh'[file]} `).join('')}</Text>
        </Box>
        <Text color={now.status === 'solved' ? 'success' : undefined}>{now.message}</Text>
        {now.status === 'solving' && Input && (
          <Input key="move" placeholder="Type a move (Nf7, e2e4) or click two squares" submitLabel="move" onSubmit={text => tryMove($, text)} />
        )}
        <Box flexDirection="row" gap={1} marginTop={1}>
          {now.status === 'solving' ? (
            <>
              <Button key="hint" label="Hint" hotkey="h" onPress={() => hint($)} />
              <Button key="reveal" label="Show solution" hotkey="s" onPress={() => reveal($)} />
              <Button key="skip" label="Skip" hotkey="n" onPress={() => nextPuzzle($)} />
            </>
          ) : (
            <Button key="next" label="Next puzzle" hotkey="n" variant="primary" onPress={() => nextPuzzle($)} />
          )}
        </Box>
      </Box>
    )
  })
}
