import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, ElementQuery, FoundElement } from 'claude-code/testing'

import { FAMOUS } from '../hooks/famous.ts'
import { puzzleFor } from '../hooks/pool.ts'
import { Chess } from '../hooks/vendor/chess.js'

const PLUGIN = 'chess-puzzles'
const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'chess-puzzles',
  props: {
    title: 'Claude Chess',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

type Finder = { find: (query: ElementQuery) => Promise<FoundElement | undefined> }

/** The Lichess puzzle on the board, read off the link under it. */
const puzzleOn = async (ui: Finder) => {
  const link = await ui.find({ type: 'Link' })
  const href = String(link?.props.href ?? '')
  const id = href.match(/training\/(\w+)/)?.[1]
  return id ? puzzleFor(`l:${id}`)! : undefined
}

const runCommand = ($: Engine, args: string) =>
  $.command.run({ command: 'chess', args, origin: { kind: 'user' } as never, presentation: { isFullscreen: true, columns: 120 } })

const watchOpens = (on: On) => {
  const opened: string[] = []
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  return opened
}

test('each surface solves a dealt puzzle by pressing squares', async ($, on) => {
  mock.store(on)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Claude Chess/ })).toBeDefined()
    const puzzle = (await puzzleOn(ui))!
    expect(puzzle).toBeDefined()
    expect(await ui.find({ text: new RegExp(puzzle.title) })).toBeDefined()
    for (let ply = 0; ply < puzzle.moves.length; ply += 2) {
      const move = puzzle.moves[ply]!
      await ui.press({ key: move.slice(0, 2) })
      await ui.press({ key: move.slice(2, 4) })
    }
    expect(await ui.find({ text: /solved!/ })).toBeDefined()
    expect(await ui.find({ text: /streak [1-9]/ })).toBeDefined()
    await ui.press({ key: 'next' })
    await ui.unmount()
  }
})

test('a clean solve raises the rating', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const puzzle = (await puzzleOn(ui))!
  for (let ply = 0; ply < puzzle.moves.length; ply += 2) {
    await ui.input({ key: 'move', text: puzzle.moves[ply]! })
  }
  expect(await ui.find({ text: /Rating \d+\?? \(\+\d+\)/ })).toBeDefined()
  await ui.unmount()
})

test('an illegal move costs nothing; a wrong one gets one more try, then the solution', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const puzzle = (await puzzleOn(ui))!
  await ui.input({ key: 'move', text: 'a1a1' })
  expect(await ui.find({ text: /isn't a legal move/ })).toBeDefined()

  // Two wrong but legal moves: any legal move of the side to move but the solution's.
  const wrong = new Chess(puzzle.fen).moves({ verbose: true }).map(move => move.lan).filter(uci => uci !== puzzle.moves[0])
  if (wrong.length < 2) return
  await ui.input({ key: 'move', text: wrong[0]! })
  expect(await ui.find({ text: /One more try/ })).toBeDefined()
  await ui.input({ key: 'move', text: wrong[1]! })
  expect(await ui.find({ text: /The solution:/ })).toBeDefined()
  expect(await ui.find({ text: /\(-\d+\)/ })).toBeDefined()
  expect(await ui.find({ key: 'retry' })).toBeDefined()
  await ui.press({ key: 'retry' })
  expect(await ui.find({ text: /Practice/ })).toBeDefined()
  await ui.unmount()
})

test('a hint names the piece, and the solution can be shown', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const puzzle = (await puzzleOn(ui))!
  await ui.press({ key: 'hint' })
  expect(await ui.find({ text: new RegExp(`on ${puzzle.moves[0]!.slice(0, 2)}`) })).toBeDefined()
  await ui.press({ key: 'reveal' })
  expect(await ui.find({ text: /Solution:/ })).toBeDefined()
  expect(await ui.find({ key: 'next' })).toBeDefined()
  await ui.unmount()
})

test('drilling a theme deals puzzles with it', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-themes' })
  expect(await ui.find({ text: /Drill a theme/ })).toBeDefined()
  await ui.press({ key: 'drill-fork' })
  for (let i = 0; i < 3; i++) {
    const puzzle = (await puzzleOn(ui))!
    expect(puzzle.themes.includes('fork')).toBe(true)
    await ui.press({ key: 'skip' })
  }
  expect(await ui.find({ text: /Theme: Fork/ })).toBeDefined()
  await ui.unmount()
})

test('the master-game set is dealt unrated', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-themes' })
  await ui.press({ key: 'drill-masters' })
  expect(await ui.find({ text: / · unrated/ })).toBeDefined()
  expect(await ui.find({ text: /^From / })).toBeDefined()
  await ui.unmount()
})

test('the difficulty button cycles and is remembered', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Difficulty: Normal/ })).toBeDefined()
  await ui.press({ key: 'difficulty' })
  expect(await ui.find({ text: /Difficulty: Harder/ })).toBeDefined()
  await ui.unmount()
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await again.find({ text: /Difficulty: Harder/ })).toBeDefined()
  await again.unmount()
})

test('a famous game steps forward, and its moves can be guessed', async ($, on) => {
  mock.store(on)
  const opera = FAMOUS.find(game => game.id === 'opera')!
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-famous' })
  expect(await ui.find({ text: /Famous games/ })).toBeDefined()
  await ui.press({ key: 'game-opera' })
  expect(await ui.find({ text: new RegExp(opera.name) })).toBeDefined()
  expect(await ui.find({ text: /Start · 33 moves/ })).toBeDefined()
  await ui.press({ key: 'forward' })
  expect(await ui.find({ text: /1\. e4/ })).toBeDefined()
  await ui.press({ key: 'first' })
  await ui.press({ key: 'guess' })
  expect(await ui.find({ text: /What did they play\?/ })).toBeDefined()
  await ui.input({ key: 'game-move', text: 'e4' })
  expect(await ui.find({ text: /Yes: 1\. e4/ })).toBeDefined()
  await ui.input({ key: 'game-move', text: 'd4' })
  expect(await ui.find({ text: /isn't the game move/ })).toBeDefined()
  await ui.press({ key: 'show-move' })
  expect(await ui.find({ text: /The game went 2\. Nf3/ })).toBeDefined()
  expect(await ui.find({ text: /1 of 2 right/ })).toBeDefined()
  await ui.unmount()
})

test('play from here asks the local Stockfish for its reply', async ($, on) => {
  mock.store(on)
  const asked: string[] = []
  on('process.run', ($, e) => {
    asked.push(e.argv[0]!)
    expect(e.init?.stdin).toMatch(/go movetime \d+\nucinewgame/)
    return { value: { exitCode: 0, stdout: 'id name Stockfish\nbestmove e7e5 ponder g1f3\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-famous' })
  await ui.press({ key: 'game-opera' })
  await ui.press({ key: 'engine' })
  expect(await ui.find({ text: /You play White from here/ })).toBeDefined()
  await ui.input({ key: 'game-move', text: 'e4' })
  expect(asked).toEqual(['stockfish'])
  expect(await ui.find({ text: /Stockfish plays e5/ })).toBeDefined()
  await ui.press({ key: 'take-back' })
  expect(await ui.find({ text: /Taken back/ })).toBeDefined()
  await ui.unmount()
})

test('without Stockfish, play from here says how to get it', async ($, on) => {
  mock.store(on)
  on('process.run', () => {
    throw new Error('spawn stockfish ENOENT')
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-famous' })
  await ui.press({ key: 'game-opera' })
  await ui.press({ key: 'engine' })
  await ui.input({ key: 'game-move', text: 'e4' })
  expect(await ui.find({ text: /Couldn't run Stockfish/ })).toBeDefined()
  await ui.unmount()
})

test('the stats tab counts a rated solve', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const puzzle = (await puzzleOn(ui))!
  for (let ply = 0; ply < puzzle.moves.length; ply += 2) await ui.input({ key: 'move', text: puzzle.moves[ply]! })
  await ui.press({ key: 'tab-stats' })
  expect(await ui.find({ text: /Rated puzzles 1 · won 1 \(100%\)/ })).toBeDefined()
  expect(await ui.find({ text: /provisional/ })).toBeDefined()
  await ui.press({ key: 'pieces' })
  expect(await ui.find({ text: /Pieces: letters/ })).toBeDefined()
  await ui.unmount()
})

test('a turn opens the pane', async ($, on) => {
  mock.store(on)
  const opened = watchOpens(on)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  expect(opened).toEqual(['chess-puzzles'])
})

test('a turn leaves the pane shut after /chess off', async ($, on) => {
  mock.store(on, { autoOpen: false })
  const opened = watchOpens(on)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  expect(opened).toEqual([])
})

test('/chess theme picks a drill by name', async ($, on) => {
  mock.store(on)
  watchOpens(on)
  const answer = await runCommand($, 'theme mate in 2')
  expect(JSON.stringify(answer)).toMatch(/Drilling Mate in 2/)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Theme: Mate in 2/ })).toBeDefined()
  expect((await puzzleOn(ui))!.themes.includes('mateIn2')).toBe(true)
  await ui.unmount()
})
