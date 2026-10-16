// What the pane draws: a header with tabs, then the puzzle, the themes to
// drill, the famous games, one game in the viewer, or your stats.

import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface } from 'claude-code'

import type { Difficulty, Drill, View } from '../types'
import { GREEN, drawBoard } from './board.tsx'
import { targetsOf, turnOf } from './chess.ts'
import { FAMOUS } from './famous.ts'
import {
  PAGE_SIZE,
  backToReplay,
  boardFen,
  famousFor,
  goTo,
  guesserOf,
  lineOf,
  numbered,
  openGame,
  pageCount,
  pressInGame,
  revealGuess,
  startEngine,
  startGuess,
  step,
  takeBack,
  turnPage,
  typedInGame,
} from './games.ts'
import { hint, nextPuzzle, peek, pressSquare, ratingText, retry, reveal, tryTyped } from './play.ts'
import { MASTER_COUNT, countOf } from './pool.ts'
import { DRILL_GROUPS, ideasOf, themeName } from './themes.ts'
import { DIFFICULTIES, DIFFICULTY_NAMES, INITIAL, KEY } from './state.ts'
import { isProvisional } from './rating.ts'

const difficulty = atom({ plugin: 'chess-puzzles', key: 'difficulty' } as const, INITIAL.difficulty)
const drill = atom({ plugin: 'chess-puzzles', key: 'drill' } as const, INITIAL.drill)
const famousPage = atom({ plugin: 'chess-puzzles', key: 'famousPage' } as const, INITIAL.famousPage)
const game = atom({ plugin: 'chess-puzzles', key: 'game' } as const, INITIAL.game)
const isWorking = atom({ plugin: 'chess-puzzles', key: 'isWorking' } as const, INITIAL.isWorking)
const rating = atom({ plugin: 'chess-puzzles', key: 'rating' } as const, INITIAL.rating)
const settings = atom({ plugin: 'chess-puzzles', key: 'settings' } as const, INITIAL.settings)
const stats = atom({ plugin: 'chess-puzzles', key: 'stats' } as const, INITIAL.stats)
const themeRecord = atom({ plugin: 'chess-puzzles', key: 'themeRecord' } as const, INITIAL.themeRecord)
const view = atom({ plugin: 'chess-puzzles', key: 'view' } as const, INITIAL.view)

const ENGINE_LEVELS: (number | null)[] = [1320, 1500, 1800, 2100, 2500, null]

export const drillName = (choice: Drill): string =>
  choice.kind === 'any' ? 'Any theme' : choice.kind === 'masters' ? 'Master games' : themeName(choice.theme)

export async function setDifficulty($: EngineInterface, choice: Difficulty) {
  await update($, difficulty, () => choice)
  await $.store.set(KEY.difficulty, choice)
}

async function cycleDifficulty($: EngineInterface) {
  const now = await read($, difficulty)
  await setDifficulty($, DIFFICULTIES[(DIFFICULTIES.indexOf(now) + 1) % DIFFICULTIES.length]!)
}

/** Switches what is dealt and deals a puzzle from it at once. */
export async function setDrill($: EngineInterface, choice: Drill) {
  await update($, drill, () => choice)
  await $.store.set(KEY.drill, choice)
  await nextPuzzle($)
  await update($, view, () => 'puzzle')
}

async function goToView($: EngineInterface, next: View) {
  if (next === 'game' && !(await read($, game))) next = 'famous'
  await update($, view, () => next)
}

async function header($: EngineInterface, table: ElementTable, current: View) {
  const { Box, Text, Button } = table
  const working = await read($, isWorking)
  const tabs: [View, string, string][] = [
    ['puzzle', 'Puzzle', '1'],
    ['themes', 'Themes', '2'],
    ['famous', 'Famous games', '3'],
    ['stats', 'Stats', '4'],
  ]
  const active = current === 'game' ? 'famous' : current
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color={GREEN}>Claude Chess</Text>
        <Text dimColor>{working ? ' · Claude is working' : ' · Claude is done'}</Text>
      </Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {tabs.map(([target, label, hotkey]) => (
          <Button key={`tab-${target}`} label={label} hotkey={hotkey} variant={active === target ? 'primary' : 'secondary'} onPress={() => goToView($, target)} />
        ))}
      </Box>
    </Box>
  )
}

async function puzzleView($: EngineInterface, table: ElementTable, hasInput: boolean) {
  const { Box, Text, Button, Link } = table
  const seen = await peek($)
  const score = await read($, stats)
  const mine = await read($, rating)
  const choice = await read($, drill)
  const level = await read($, difficulty)
  const look = await read($, settings)
  const { now, puzzle } = seen
  const isOver = now.status !== 'solving'
  const ideas = ideasOf(puzzle.themes)
  const Input = hasInput && 'Input' in table ? table.Input : undefined

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>{puzzle.title}</Text>
        <Text dimColor>{puzzle.rating === undefined ? ' · unrated' : ` · rated ${puzzle.rating}`} · {drillName(choice)}</Text>
      </Text>
      <Text dimColor>
        Your rating {ratingText(mine)} · solved {score.solved} · streak {score.streak}
      </Text>
      {drawBoard(table, {
        fen: now.fen,
        isFlipped: turnOf(puzzle.fen) === 'b',
        selected: now.selected,
        targets: now.selected && !isOver ? targetsOf(now.fen, now.selected) : [],
        lastMove: now.lastMove,
        pieces: look.pieces,
        onPress: square => pressSquare($, square),
      })}
      <Text color={now.status === 'solved' ? 'success' : now.status === 'failed' ? 'error' : undefined}>{now.message}</Text>
      {isOver && ideas.length > 0 && <Text dimColor>Ideas: {ideas.join(', ')}</Text>}
      {!isOver && Input && (
        <Input key="move" placeholder="Type a move (Nf7, e2e4) or click two squares" submitLabel="move" onSubmit={text => tryTyped($, text)} />
      )}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
        {isOver ? (
          <>
            <Button key="next" label="Next puzzle" hotkey="n" variant="primary" onPress={() => nextPuzzle($)} />
            <Button key="retry" label="Try again" hotkey="r" onPress={() => retry($)} />
          </>
        ) : (
          <>
            <Button key="hint" label="Hint" hotkey="h" onPress={() => hint($)} />
            <Button key="reveal" label="Show solution" hotkey="s" onPress={() => reveal($)} />
            <Button key="skip" label="Skip" hotkey="n" onPress={() => nextPuzzle($)} />
          </>
        )}
        {choice.kind !== 'masters' && <Button key="difficulty" label={`Difficulty: ${DIFFICULTY_NAMES[level]}`} hotkey="d" onPress={() => cycleDifficulty($)} />}
        <Button key="theme" label={`Theme: ${drillName(choice)}`} hotkey="t" onPress={() => goToView($, 'themes')} />
      </Box>
      <Box marginTop={1}>
        {puzzle.link ? <Link href={puzzle.link} label={puzzle.credit} /> : <Text dimColor>{puzzle.credit}</Text>}
      </Box>
    </Box>
  )
}

async function themesView($: EngineInterface, table: ElementTable) {
  const { Box, Text, Button } = table
  const choice = await read($, drill)
  const record = await read($, themeRecord)
  const tally = (theme: string) => {
    const [played = 0, won = 0] = record[theme] ?? []
    return played ? ` ${won}/${played}` : ''
  }
  const isChosen = (theme: string) => choice.kind === 'theme' && choice.theme === theme

  return (
    <Box flexDirection="column">
      <Text bold>Drill a theme</Text>
      <Text dimColor>Rated puzzles near your rating that use one idea. Your record shows as won/played.</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
        <Button key="drill-any" variant={choice.kind === 'any' ? 'primary' : 'secondary'} onPress={() => setDrill($, { kind: 'any' })}>
          Any theme
        </Button>
        <Button key="drill-masters" variant={choice.kind === 'masters' ? 'primary' : 'secondary'} onPress={() => setDrill($, { kind: 'masters' })}>
          Master games <Text dimColor>{MASTER_COUNT}, unrated</Text>
        </Button>
      </Box>
      {DRILL_GROUPS.map(group => (
        <Box key={`group-${group.name}`} flexDirection="column" marginTop={1}>
          <Text color={GREEN} bold>{group.name}</Text>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {group.drills.map(entry => (
              <Button
                key={`drill-${entry.theme}`}
                variant={isChosen(entry.theme) ? 'primary' : 'secondary'}
                onPress={() => setDrill($, { kind: 'theme', theme: entry.theme })}
              >
                {entry.name}
                <Text dimColor>{tally(entry.theme) || ` ${countOf(entry.theme)}`}</Text>
              </Button>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

async function famousView($: EngineInterface, table: ElementTable) {
  const { Box, Text, Button } = table
  const page = Math.min(await read($, famousPage), pageCount - 1)
  const shown = FAMOUS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  return (
    <Box flexDirection="column">
      <Text bold>Famous games</Text>
      <Text dimColor>Step through them, guess the winner's moves, or play on against Stockfish.</Text>
      <Box flexDirection="column" marginY={1}>
        {shown.map(famous => (
          <Button key={`game-${famous.id}`} plain onPress={() => openGame($, famous.id)}>
            {famous.name}
            <Text dimColor> · {famous.white} vs {famous.black}, {famous.year}</Text>
          </Button>
        ))}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        {page > 0 && <Button key="page-back" label="Earlier" hotkey="b" onPress={() => turnPage($, -1)} />}
        {page < pageCount - 1 && <Button key="page-next" label="Later" hotkey="n" onPress={() => turnPage($, 1)} />}
        <Text dimColor>
          Page {page + 1} of {pageCount}
        </Text>
      </Box>
    </Box>
  )
}

async function gameView($: EngineInterface, table: ElementTable, hasInput: boolean) {
  const { Box, Text, Button, Link } = table
  const state = await read($, game)
  const famous = state && famousFor(state.id)
  if (!state || !famous) return famousView($, table)
  const line = lineOf(famous)
  const look = await read($, settings)
  const fen = boardFen(state, line)
  const total = line.moves.length
  const last = state.engine ? state.engine.moves.at(-1) ?? null : state.ply > 0 ? line.moves[state.ply - 1]!.uci : null
  const bottom = state.mode === 'engine' && state.engine ? state.engine.side : state.mode === 'guess' ? guesserOf(famous) : 'w'
  const isPlaying = state.mode !== 'replay'
  const isOver = state.mode === 'engine' ? Boolean(state.engine?.over) : state.mode === 'guess' && state.ply >= total
  const Input = hasInput && 'Input' in table ? table.Input : undefined
  const where =
    state.ply === 0 ? `Start · ${total} moves` : `Move ${Math.floor((state.ply - 1) / 2) + 1}: ${numbered(state.ply - 1, line.moves[state.ply - 1]!.san)} · ${state.ply} of ${total}`

  return (
    <Box flexDirection="column">
      <Text bold color={GREEN}>{famous.name}</Text>
      <Text dimColor>
        {famous.white} vs {famous.black} · {famous.event}, {famous.year} · {famous.result}
      </Text>
      {state.mode === 'replay' && <Text>{famous.blurb}</Text>}
      {state.mode === 'replay' && <Link href={famous.source} label="Source" />}
      {drawBoard(table, {
        fen,
        isFlipped: bottom === 'b',
        selected: state.selected,
        targets: state.selected && isPlaying && !isOver ? targetsOf(fen, state.selected) : [],
        lastMove: last,
        pieces: look.pieces,
        onPress: isPlaying ? square => pressInGame($, square) : undefined,
      })}
      <Text dimColor>
        {state.mode === 'engine'
          ? `Against Stockfish${look.engineElo === null ? '' : ` (about ${look.engineElo})`} · ${state.engine?.moves.length ?? 0} moves played`
          : state.mode === 'guess'
            ? `Guessing · ${state.guess.matched} of ${state.guess.tried} right · ${where}`
            : where}
      </Text>
      {state.message !== '' && <Text>{state.message}</Text>}
      {isPlaying && !isOver && Input && (
        <Input key="game-move" placeholder="Type a move or click two squares" submitLabel="move" onSubmit={text => typedInGame($, text)} />
      )}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
        {state.mode === 'replay' && (
          <>
            <Button key="first" label="|<" hotkey="a" onPress={() => goTo($, 0)} />
            <Button key="back" label="<" hotkey="b" onPress={() => step($, -1)} />
            <Button key="forward" label=">" hotkey="n" variant="primary" onPress={() => step($, 1)} />
            <Button key="last" label=">|" hotkey="e" onPress={() => goTo($, total)} />
            <Button key="guess" label="Guess the moves" hotkey="g" onPress={() => startGuess($)} />
            <Button key="engine" label="Play from here" hotkey="p" onPress={() => startEngine($)} />
          </>
        )}
        {state.mode === 'guess' && !isOver && <Button key="show-move" label="Show the move" hotkey="s" onPress={() => revealGuess($)} />}
        {state.mode === 'guess' && <Button key="stop" label="Stop guessing" hotkey="x" onPress={() => backToReplay($)} />}
        {state.mode === 'engine' && (
          <>
            <Button key="take-back" label="Take back" hotkey="t" onPress={() => takeBack($)} />
            <Button
              key="strength"
              label={`Stockfish: ${look.engineElo === null ? 'full strength' : look.engineElo}`}
              hotkey="k"
              onPress={() => cycleEngineLevel($)}
            />
            <Button key="stop" label="Back to the game" hotkey="x" onPress={() => backToReplay($)} />
          </>
        )}
        <Button key="list" label="All games" hotkey="l" onPress={() => goToView($, 'famous')} />
      </Box>
    </Box>
  )
}

async function cycleEngineLevel($: EngineInterface) {
  await update($, settings, value => {
    const index = ENGINE_LEVELS.indexOf(value.engineElo)
    return { ...value, engineElo: ENGINE_LEVELS[(index + 1) % ENGINE_LEVELS.length]! }
  })
  await $.store.set(KEY.settings, await read($, settings))
}

const SPARKS = '▁▂▃▄▅▆▇█'

/** The ratings as a row of bars, lowest to highest. */
export const sparkline = (values: readonly number[]): string => {
  if (values.length === 0) return ''
  const low = Math.min(...values)
  const high = Math.max(...values)
  return values.map(value => SPARKS[high === low ? 3 : Math.round(((value - low) / (high - low)) * (SPARKS.length - 1))]).join('')
}

async function togglePieces($: EngineInterface) {
  await update($, settings, value => ({ ...value, pieces: value.pieces === 'symbols' ? ('letters' as const) : ('symbols' as const) }))
  await $.store.set(KEY.settings, await read($, settings))
}

async function statsView($: EngineInterface, table: ElementTable) {
  const { Box, Text, Button } = table
  const mine = await read($, rating)
  const score = await read($, stats)
  const record = await read($, themeRecord)
  const look = await read($, settings)
  const rated = Object.entries(record)
    .filter(([theme, [played]]) => played >= 3 && !['advantage', 'crushing', 'mate', 'short', 'long', 'oneMove', 'middlegame', 'endgame'].includes(theme))
    .map(([theme, [played, won]]) => ({ theme, played, won, rate: won / played }))
  const strongest = [...rated].sort((a, b) => b.rate - a.rate || b.played - a.played).slice(0, 5)
  const weakest = [...rated].sort((a, b) => a.rate - b.rate || b.played - a.played).slice(0, 5)
  const percent = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : '–')
  const recent = mine.history.slice(-30)
  const row = (entry: { theme: string; played: number; won: number }) => (
    <Text key={`theme-${entry.theme}`}>
      {themeName(entry.theme)} <Text dimColor>{entry.won}/{entry.played} ({percent(entry.won, entry.played)})</Text>
    </Text>
  )

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>Rating {ratingText(mine)}</Text>
        <Text dimColor>
          {isProvisional(mine) ? ' · provisional, settles after a few more puzzles' : ` · ±${Math.round(mine.deviation)}`}
          {mine.played > 0 && !isProvisional(mine) ? ` · peak ${Math.round(mine.peak)}` : ''}
        </Text>
      </Text>
      <Text dimColor>
        Rated puzzles {mine.played} · won {mine.wins} ({percent(mine.wins, mine.played)}) · solved {score.solved} · streak {score.streak} · best streak {score.bestStreak}
      </Text>
      {recent.length > 1 && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color={GREEN}>{sparkline(recent)}</Text>
          </Text>
          <Text dimColor>
            Last {recent.length} rated puzzles: {Math.min(...recent)} to {Math.max(...recent)}
          </Text>
        </Box>
      )}
      {rated.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={GREEN}>Strongest</Text>
          {strongest.map(row)}
          <Text bold color={GREEN}>Weakest</Text>
          {weakest.map(row)}
        </Box>
      ) : (
        <Text dimColor>Play a few rated puzzles and your strongest and weakest themes show here.</Text>
      )}
      <Box flexDirection="row" columnGap={1} marginTop={1}>
        <Button key="pieces" label={`Pieces: ${look.pieces}`} hotkey="y" onPress={() => togglePieces($)} />
      </Box>
    </Box>
  )
}

/** The whole pane: header and tabs, then the view chosen. */
export async function drawPane($: EngineInterface, table: ElementTable, hasInput: boolean) {
  const { Box } = table
  const current = await read($, view)
  const body =
    current === 'themes'
      ? await themesView($, table)
      : current === 'famous'
        ? await famousView($, table)
        : current === 'game'
          ? await gameView($, table, hasInput)
          : current === 'stats'
            ? await statsView($, table)
            : await puzzleView($, table, hasInput)
  return (
    <Box flexDirection="column">
      {await header($, table, current)}
      <Box marginTop={1} flexDirection="column">
        {body}
      </Box>
    </Box>
  )
}

