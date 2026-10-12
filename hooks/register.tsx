import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LevelChoice, PuzzleProgress, PuzzleStats } from '../types'
import { applyUci, colorOf, isSameMove, parseFen, pieceName, squareIndex, squareName, toFen } from './chess.ts'
import { PUZZLES } from './puzzles.ts'

const PANE = 'chess-puzzles'
const TITLE = 'Chess puzzle'

const progress = atom({ plugin: 'chess-puzzles', key: 'progress' } as const, null)
const stats = atom({ plugin: 'chess-puzzles', key: 'stats' } as const, { solved: 0, streak: 0 })
const isWorking = atom({ plugin: 'chess-puzzles', key: 'isWorking' } as const, false)
const level = atom({ plugin: 'chess-puzzles', key: 'level' } as const, 'mixed')
const review = atom({ plugin: 'chess-puzzles', key: 'review' } as const, [])

// $.store keys: kept across sessions.
const NEXT_KEY = 'next'
const STATS_KEY = 'stats'
const AUTO_OPEN_KEY = 'autoOpen'
const LEVEL_KEY = 'level'
const REVIEW_KEY = 'review'
const SINCE_REVIEW_KEY = 'sinceReview'

/** Every this many puzzles dealt, one comes from the review queue if it holds one at the level. */
const REVIEW_EVERY = 3

const LEVELS: LevelChoice[] = ['mixed', 'easy', 'medium', 'hard']
const LEVEL_NAMES: Record<LevelChoice, string> = { mixed: 'Mixed', easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const isLevelChoice = (value: unknown): value is LevelChoice => LEVELS.includes(value as LevelChoice)

const sideName = (fen: string) => (parseFen(fen).turn === 'w' ? 'White' : 'Black')

/** The first puzzle at the level from index on, wrapping around the set. */
const firstAt = (index: number, choice: LevelChoice): number => {
  for (let step = 0; step < PUZZLES.length; step++) {
    const at = (index + step) % PUZZLES.length
    if (choice === 'mixed' || PUZZLES[at]!.level === choice) return at
  }
  return index % PUZZLES.length
}

const fresh = (index: number, isReview = false): PuzzleProgress => {
  const puzzle = PUZZLES[index]!
  return {
    index,
    isReview,
    ply: 0,
    fen: puzzle.fen,
    selected: null,
    message: `${isReview ? 'Another try. ' : ''}${sideName(puzzle.fen)} to move. ${puzzle.title}.`,
    status: 'solving',
    misses: 0,
  }
}

/** The puzzle on the board, or the one that would be dealt; writes nothing, so a drawing may call it. */
const peek = async ($: EngineInterface): Promise<PuzzleProgress> =>
  (await read($, progress)) ?? fresh(firstAt(Number((await $.store.get(NEXT_KEY)) ?? 0), await read($, level)))

/** The puzzle on the board, dealing the next one from the store if none is. */
const current = async ($: EngineInterface): Promise<PuzzleProgress> => {
  const now = await read($, progress)
  if (now) return now
  const next = firstAt(Number((await $.store.get(NEXT_KEY)) ?? 0), await read($, level))
  const dealt = fresh(next)
  await update($, progress, value => value ?? dealt)
  return (await read($, progress)) ?? dealt
}

/** The last new (not review) puzzle dealt. */
const lastNew = async ($: EngineInterface) => Number((await $.store.get(NEXT_KEY)) ?? 0)

const deal = async ($: EngineInterface, from: number) => {
  const index = firstAt(from, await read($, level))
  await $.store.set(NEXT_KEY, index)
  await update($, progress, () => fresh(index))
}

const saveReview = async ($: EngineInterface, change: (queue: number[]) => number[]) => {
  await update($, review, change)
  await $.store.set(REVIEW_KEY, await read($, review))
}

/** The oldest puzzle in the review queue at the level, other than the one on the board. */
const dueReview = async ($: EngineInterface, choice: LevelChoice): Promise<number | undefined> => {
  const now = await read($, progress)
  return (await read($, review)).find(
    index => index !== now?.index && (choice === 'mixed' || PUZZLES[index]?.level === choice),
  )
}

const dealReview = async ($: EngineInterface, index: number) => {
  await $.store.set(SINCE_REVIEW_KEY, 0)
  await update($, progress, () => fresh(index, true))
}

const nextPuzzle = async ($: EngineInterface) => {
  await current($)
  const since = Number((await $.store.get(SINCE_REVIEW_KEY)) ?? 0) + 1
  const due = since >= REVIEW_EVERY ? await dueReview($, await read($, level)) : undefined
  if (due !== undefined) return dealReview($, due)
  await $.store.set(SINCE_REVIEW_KEY, since)
  await deal($, (await lastNew($)) + 1)
}

/** Deals the oldest missed puzzle at any level; false when there is none. */
const startReview = async ($: EngineInterface): Promise<boolean> => {
  await current($)
  const due = await dueReview($, 'mixed')
  if (due === undefined) return false
  await dealReview($, due)
  return true
}

/** Switches the level and deals a puzzle at it, unless the one on the board already is. */
const setLevel = async ($: EngineInterface, choice: LevelChoice) => {
  await update($, level, () => choice)
  await $.store.set(LEVEL_KEY, choice)
  const now = await current($)
  if (choice !== 'mixed' && PUZZLES[now.index]!.level !== choice) await deal($, await lastNew($))
}

const cycleLevel = async ($: EngineInterface) => {
  const now = await read($, level)
  await setLevel($, LEVELS[(LEVELS.indexOf(now) + 1) % LEVELS.length]!)
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
    // A slip or a hint puts the puzzle in the review queue; a clean solve takes it out.
    await saveReview($, queue =>
      now.misses === 0 ? queue.filter(index => index !== now.index) : queue.includes(now.index) ? queue : [...queue, now.index],
    )
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
  await saveReview($, queue => (queue.includes(now.index) ? queue : [...queue, now.index]))
  await update($, progress, value =>
    value && { ...value, status: 'revealed' as const, selected: null, message: `Solution: ${puzzle.san.join(' ')}` },
  )
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: TITLE })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chess',
      description:
        'Open the chess puzzle pane; "/chess easy", "medium", "hard" or "mixed" picks the level; "/chess review" retries a missed puzzle; "/chess off" stops it opening while Claude works, "/chess on" turns that back on',
      argumentHint: '[easy|medium|hard|mixed|next|review|on|off]',
    })
    const saved = (await $.store.get(STATS_KEY)) as PuzzleStats | undefined
    if (saved) await update($, stats, () => saved)
    const savedLevel = await $.store.get(LEVEL_KEY)
    if (isLevelChoice(savedLevel)) await update($, level, () => savedLevel)
    const savedReview = await $.store.get(REVIEW_KEY)
    if (Array.isArray(savedReview)) {
      await update($, review, () => savedReview.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < PUZZLES.length))
    }
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
    if (arg === 'review' && !(await startReview($))) return { text: 'No missed puzzles to review yet.' }
    if (isLevelChoice(arg)) await setLevel($, arg)
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
    const choice = await read($, level)
    const toReview = (await read($, review)).length
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
          <Text dimColor>
            {' '}· {LEVEL_NAMES[puzzle.level]}
            {now.isReview ? ' · review' : ''} · solved {score.solved} · streak {score.streak}
            {toReview > 0 ? ` · ${toReview} to review` : ''}
          </Text>
        </Text>
        <Text dimColor>From {puzzle.game}</Text>
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
          <Button key="level" label={`Level: ${LEVEL_NAMES[choice]}`} hotkey="l" onPress={() => cycleLevel($)} />
        </Box>
      </Box>
    )
  })
}
